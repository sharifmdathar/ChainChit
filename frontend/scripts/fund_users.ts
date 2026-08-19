/**
 * fund_users.ts — Batch-fund mainnet users with XLM + USDC from the admin account.
 *
 * Reads a CSV (address,usdc_amount) and for each user:
 *   1. Creates the account if it doesn't exist (funds ~3.5 XLM reserve + fees)
 *   2. Establishes a USDC trustline if missing
 *   3. Transfers the requested USDC amount via the USDC SAC
 *
 * Usage (from frontend/):
 *   SOROBAN_SECRET_KEY=S... \
 *   USERS_CSV=../docs/users.csv \
 *   NEXT_PUBLIC_USDC_CONTRACT=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75 \
 *   NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
 *   npx ts-node scripts/fund_users.ts
 *
 * CSV format (no header):
 *   GBXXXXX...,50
 *   GBYYYYY...,100
 *
 * Prints one line per user: address, created?, trustline?, usdc tx hash.
 * Copy output into docs/USERS.md as on-chain proof.
 */
import { Keypair, TransactionBuilder, Asset, Operation, Contract, Address, Horizon, rpc, xdr } from "@stellar/stellar-sdk";
import * as fs from "fs";

const SECRET = process.env.SOROBAN_SECRET_KEY;
const CSV_PATH = process.env.USERS_CSV || "users.csv";
const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT;
const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER || "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "PUBLIC";

const RPC_URL = NETWORK === "TESTNET" ? "https://soroban-testnet.stellar.org" : "https://rpc.stellar.org";
const HORIZON_URL = NETWORK === "TESTNET" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org";
const PASSPHRASE = NETWORK === "TESTNET" ? "Test SDF Network ; September 2015" : "Public Global Stellar Network ; September 2015";

const USDC_DECIMALS = 7n;
const NEW_ACCOUNT_XLM = "3.5"; // reserve (2.5) + fee buffer

if (!SECRET) throw new Error("SOROBAN_SECRET_KEY env var required");
if (!USDC_CONTRACT_ID) throw new Error("NEXT_PUBLIC_USDC_CONTRACT env var required");

const admin = Keypair.fromSecret(SECRET);
const adminAddress = admin.publicKey();
const horizon = new Horizon.Server(HORIZON_URL); // classic ops: accounts, trustlines
const soroban = new rpc.Server(RPC_URL); // Soroban RPC: SAC transfers
const contract = new Contract(USDC_CONTRACT_ID);

interface CsvRow {
  address: string;
  usdcAmount: string;
}

function parseCsv(path: string): CsvRow[] {
  return fs
    .readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => {
      const [address, usdcAmount] = l.split(",").map((s) => s.trim());
      if (!address || !usdcAmount) throw new Error(`Invalid CSV line: "${l}"`);
      if (!address.startsWith("G") || address.length !== 56) throw new Error(`Invalid Stellar address: ${address}`);
      return { address, usdcAmount };
    });
}

async function accountExists(address: string): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch {
    return false;
  }
}

async function hasUsdcTrustline(address: string): Promise<boolean> {
  try {
    const acc = await horizon.loadAccount(address);
    return acc.balances.some((b: any) => b.asset_type === "credit_alphanum4" && b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER);
  } catch {
    return false;
  }
}

async function submitClassic(tx: any): Promise<string> {
  tx.sign(admin);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

async function submitSoroban(tx: any): Promise<string> {
  const simulated = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) throw new Error(`Simulation error: ${simulated.error}`);
  const assembled = rpc.assembleTransaction(tx, simulated).build();
  assembled.sign(admin);
  const res = await soroban.sendTransaction(assembled);
  if (res.status === "ERROR") throw new Error(`Tx failed: ${res.errorResult}`);
  return res.hash;
}

async function fundUser(row: CsvRow): Promise<{ created: boolean; trustline: boolean; usdcHash: string | null }> {
  const { address } = row;
  const usdcUnits = BigInt(Math.round(parseFloat(row.usdcAmount) * 1e7));

  const exists = await accountExists(address);
  const trustline = exists ? await hasUsdcTrustline(address) : false;

  if (!exists) {
    const account = await horizon.loadAccount(adminAddress);
    const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: PASSPHRASE })
      .addOperation(
        Operation.createAccount({
          destination: address,
          startingBalance: NEW_ACCOUNT_XLM,
        })
      )
      .addOperation(Operation.changeTrust({ source: address, asset: new Asset("USDC", USDC_ISSUER) }))
      .setTimeout(60)
      .build();
    await submitClassic(tx);
  } else if (!trustline) {
    const account = await horizon.loadAccount(adminAddress);
    const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: PASSPHRASE })
      .addOperation(Operation.changeTrust({ source: address, asset: new Asset("USDC", USDC_ISSUER) }))
      .setTimeout(60)
      .build();
    await submitClassic(tx);
  }

  const adminAccount = await soroban.getAccount(adminAddress);
  const usdcTx = new TransactionBuilder(adminAccount, { fee: "100000", networkPassphrase: PASSPHRASE })
    .addOperation(
      contract.call(
        "transfer",
        Address.fromString(adminAddress).toScVal(),
        Address.fromString(address).toScVal(),
        xdr.ScVal.scvI128(
          new xdr.Int128Parts({ lo: new xdr.Uint64(usdcUnits & 0xffffffffffffffffn), hi: new xdr.Int64((usdcUnits >> 64n) & 0x7fffffffffffffffn) })
        )
      )
    )
    .setTimeout(60)
    .build();

  const usdcHash = await submitSoroban(usdcTx);
  return { created: !exists, trustline: exists && trustline, usdcHash };
}

async function main() {
  const rows = parseCsv(CSV_PATH);
  console.log(`Funding ${rows.length} users from ${adminAddress} on ${NETWORK}`);
  for (const row of rows) {
    try {
      const r = await fundUser(row);
      console.log(`${row.address} | created=${r.created} | had_trustline=${r.trustline} | usdc_tx=${r.usdcHash}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${row.address} | ERROR: ${msg}`);
    }
  }
  console.log("Done. Copy the usdc_tx hashes into docs/USERS.md as on-chain proof.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});