/**
 * sweep_usdc.ts — Return leftover testnet USDC from provisioned wallets.
 *
 * Reads frontend/.provision-keys.local.json and transfers each wallet's
 * entire USDC balance (of the configured issuer) to DEST_ADDRESS. Wallets
 * with a zero balance are skipped. XLM stays put so the accounts (and their
 * on-chain history) remain alive as activity proof.
 *
 * Usage (from frontend/):
 *   DEST_ADDRESS=G… npx tsx scripts/sweep_usdc.ts
 */
import { Keypair, TransactionBuilder, Contract, Address, Horizon, rpc, xdr } from "@stellar/stellar-sdk";
import * as fs from "fs";

try {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* env file optional */
}

const DEST = process.env.DEST_ADDRESS;
const KEYS_FILE = ".provision-keys.local.json";
const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const PASSPHRASE = "Test SDF Network ; September 2015";

const horizon = new Horizon.Server(HORIZON_URL);
const soroban = new rpc.Server(RPC_URL);
const usdc = new Contract(process.env.NEXT_PUBLIC_USDC_CONTRACT!);

interface Rec { secret: string; public: string; group?: string }

async function main(): Promise<void> {
  if (!DEST) throw new Error("DEST_ADDRESS env var required");
  const store: Record<string, Rec> = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
  const wallets = Object.values(store);
  console.log(`sweeping ${wallets.length} wallets → ${DEST}\n`);

  let swept = 0;
  let total = 0;
  for (const rec of wallets) {
    try {
      const acc = await horizon.loadAccount(rec.public);
      const bal = acc.balances.find(
        (b: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
          b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
      ) as { balance: string } | undefined;
      const units = bal ? BigInt(Math.round(Number(bal.balance) * 1e7)) : BigInt(0);
      if (units <= BigInt(0)) continue;

      const kp = Keypair.fromSecret(rec.secret);
      const tx = new TransactionBuilder(await soroban.getAccount(rec.public), {
        fee: "100000",
        networkPassphrase: PASSPHRASE,
      })
        .addOperation(
          usdc.call("transfer", Address.fromString(rec.public).toScVal(), Address.fromString(DEST).toScVal(), i128(units))
        )
        .setTimeout(60)
        .build();
      const sim = await soroban.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
      const assembled = rpc.assembleTransaction(tx, sim).build();
      assembled.sign(kp);
      await soroban.sendTransaction(assembled);
      console.log(`${rec.public.slice(0, 8)}… → ${(Number(units) / 1e7).toFixed(2)} USDC`);
      swept += 1;
      total += Number(units) / 1e7;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${rec.public.slice(0, 8)}… ERROR: ${msg}`);
    }
  }
  console.log(`\nswept ${swept} wallets, total ${(total).toFixed(2)} USDC`);
}

function i128(v: bigint): xdr.ScVal {
  const mask64 = (BigInt(1) << BigInt(64)) - BigInt(1);
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: new xdr.Uint64(v & mask64),
      hi: new xdr.Int64(BigInt.asIntN(64, v >> BigInt(64))),
    })
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
