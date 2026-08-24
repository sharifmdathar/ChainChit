/**
 * provision_committee.ts — Committee provisioning tool for ChainChit organizers.
 *
 * Mirrors how real chit funds work: the organizer (foreman/pradhan) sets up the
 * committee on behalf of members who may not be technical — they receive a
 * funded wallet and simply participate. This tool provisions a full committee
 * in one run:
 *
 *   1. Creates member wallets and funds them (testnet faucet)
 *   2. Establishes USDC trustlines so members can contribute
 *   3. Deploys chit groups through the factory with open-join settings
 *   4. Drives the full lifecycle: join → contribute → commit/reveal bids → payout
 *
 * Also serves as an end-to-end integration harness for CI-style testnet runs.
 * Every step emits a real on-chain transaction.
 *
 * TESTNET ONLY. Never point this at mainnet.
 *
 * Usage (from frontend/):
 *   SOROBAN_SECRET_KEY=S... \
 *   NEXT_PUBLIC_NETWORK=TESTNET \
 *   NEXT_PUBLIC_FACTORY_CONTRACT=CAJBU4IDXR5PFHY3AKRDUS2LTRID7ONORUXJJYG5LDPTG2QMREINLF6V \
 *   NEXT_PUBLIC_USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA \
 *   npx tsx scripts/provision_committee.ts --users 40 --group-size 20 --cycles 2 --contribution 2.5
 *
 * Outputs:
 *   - frontend/.provision-keys.local.json (gitignored — wallet keys, resume support)
 *   - ../docs/users_testnet.csv           (ledger: address, group, tx hashes)
 *
 * Resume behaviour: re-running skips wallets that already exist and groups
 * already created, so an interrupted run can simply be repeated.
 */
import { Keypair, TransactionBuilder, Asset, Operation, Contract, Address, Horizon, rpc, xdr } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as crypto from "crypto";

// Load frontend/.env.local (KEY=VALUE lines); real env vars keep priority.
try {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* no .env.local — env vars or CLI-provided values must cover config */
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECRET = process.env.SOROBAN_SECRET_KEY;
const FACTORY_ID = process.env.NEXT_PUBLIC_FACTORY_CONTRACT;
const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT;
const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER || "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "TESTNET";

const RPC_URL = NETWORK === "TESTNET" ? "https://soroban-testnet.stellar.org" : "https://rpc.stellar.org";
const HORIZON_URL = NETWORK === "TESTNET" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const PASSPHRASE = NETWORK === "TESTNET" ? "Test SDF Network ; September 2015" : "Public Global Stellar Network ; September 2015";

if (NETWORK !== "TESTNET") {
  throw new Error("provision_committee.ts is TESTNET ONLY. Set NEXT_PUBLIC_NETWORK=TESTNET.");
}
if (!SECRET) throw new Error("SOROBAN_SECRET_KEY env var required");
if (!FACTORY_ID) throw new Error("NEXT_PUBLIC_FACTORY_CONTRACT env var required");
if (!USDC_CONTRACT_ID) throw new Error("NEXT_PUBLIC_USDC_CONTRACT env var required");

// CLI args
function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const TOTAL_USERS = arg("users", 40);
const GROUP_SIZE = arg("group-size", 20);
const CYCLES = Math.max(1, Math.floor(arg("cycles", 2)));
const CONTRIBUTION_USDC = arg("contribution", 2.5); // whole USDC per cycle
const FUNDING_USDC_PER_USER = arg("fund-usdc", 10); // headroom: contributions + fees

const USDC_DECIMALS = 1e7;
const CONTRIBUTION_UNITS = BigInt(Math.round(CONTRIBUTION_USDC * USDC_DECIMALS));
const FUNDING_UNITS = BigInt(Math.round(FUNDING_USDC_PER_USER * USDC_DECIMALS));

const TX_FEE = "1000000"; // covers cross-contract calls (reputation updates)
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

const KEYS_FILE = ".provision-keys.local.json";
const LEDGER_FILE = "../docs/users_testnet.csv";

const admin = Keypair.fromSecret(SECRET);
const adminAddress = admin.publicKey();
const horizon = new Horizon.Server(HORIZON_URL);
const soroban = new rpc.Server(RPC_URL);
const factory = new Contract(FACTORY_ID);
const usdc = new Contract(USDC_CONTRACT_ID);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface UserRecord {
  secret: string;
  public: string;
  friendbotTx?: string;
  trustlineTx?: string;
  fundingTx?: string;
  group?: string;
  joinTx?: string;
}

// ---------------------------------------------------------------------------
// Key store (gitignored; enables resume across interrupted runs)
// ---------------------------------------------------------------------------

function loadKeyStore(): Record<string, UserRecord> {
  if (fs.existsSync(KEYS_FILE)) {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) as Record<string, UserRecord>;
  }
  return {};
}

function saveKeyStore(store: Record<string, UserRecord>): void {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(store, null, 2));
}

// ---------------------------------------------------------------------------
// Low-level submit helpers
// ---------------------------------------------------------------------------

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
    return acc.balances.some(
      (b: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
        b.asset_type === "credit_alphanum4" && b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
    );
  } catch {
    return false;
  }
}

/** Submit a classic (Horizon) tx signed by `signers`. */
async function submitClassic(tx: ReturnType<TransactionBuilder["build"]>, signers: Keypair[]): Promise<string> {
  for (const s of signers) tx.sign(s);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

/**
 * Build, simulate, sign and submit a Soroban invocation, then poll until the
 * transaction lands. Returns the tx hash.
 */
async function invokeAndPoll(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  source: Keypair
): Promise<string> {
  const account = await soroban.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();

  const simulated = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`${method} simulation failed: ${simulated.error}`);
  }
  const assembled = rpc.assembleTransaction(tx, simulated).build();
  assembled.sign(source);

  let hash = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const sent = await soroban.sendTransaction(assembled);
    if (sent.status === "ERROR") throw new Error(`${method} send failed: ${JSON.stringify(sent.errorResult)}`);
    hash = sent.hash;
    if (sent.status === "PENDING") break;
    await sleep(500);
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const status = await soroban.getTransaction(hash);
      if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) return hash;
      if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`${method} tx ${hash} failed on-chain`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("failed on-chain")) throw e;
      // transient RPC hiccup — keep polling
    }
  }
  throw new Error(`${method} tx ${hash} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

// ---------------------------------------------------------------------------
// Step 1 — wallets: generate, friendbot-fund, trustline, admin top-up
// ---------------------------------------------------------------------------

async function friendbotFund(address: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`);
      if (res.status === 429 || res.status === 503) {
        await sleep(attempt * 3000);
        continue;
      }
      if (!res.ok) throw new Error(`friendbot ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { hash?: string };
      return body.hash ?? null;
    } catch (e) {
      if (attempt === 6) throw e;
      await sleep(attempt * 3000);
    }
  }
  return null;
}

async function waitForTrustline(address: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await hasUsdcTrustline(address)) return true;
    await sleep(2000);
  }
  return false;
}

async function ensureWallet(rec: UserRecord): Promise<void> {
  const exists = await accountExists(rec.public);
  if (!exists) {
    console.log(`  [wallet] creating ${rec.public.slice(0, 8)}… via friendbot`);
    rec.friendbotTx = (await friendbotFund(rec.public)) ?? undefined;
  }

  if (!(await hasUsdcTrustline(rec.public))) {
    // Friendbot/ledger-close latency: the account may not be queryable yet.
    await waitForAccount(rec.public);
    console.log(`  [wallet] USDC trustline for ${rec.public.slice(0, 8)}…`);
    const user = Keypair.fromSecret(rec.secret);
    const acc = await horizon.loadAccount(rec.public);
    const tx = new TransactionBuilder(acc, { fee: "50000", networkPassphrase: PASSPHRASE })
      .addOperation(Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }))
      .setTimeout(60)
      .build();
    rec.trustlineTx = await submitClassic(tx, [user]);
    // Soroban sim reads ledger state — wait until the trustline is actually visible.
    if (!(await waitForTrustline(rec.public))) {
      throw new Error(`trustline for ${rec.public} not visible after 30s`);
    }
  }
}

async function waitForAccount(address: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await accountExists(address)) return;
    await sleep(2000);
  }
  throw new Error(`account ${address} not visible after 30s`);
}

async function fundUserUsdc(rec: UserRecord): Promise<void> {
  // Skip if the user already holds ≥ contribution units.
  try {
    const acc = await horizon.loadAccount(rec.public);
    const bal = acc.balances.find(
      (b: { asset_type: string; asset_code?: string }) => b.asset_code === "USDC"
    ) as { balance: string } | undefined;
    if (bal && BigInt(Math.round(Number(bal.balance) * USDC_DECIMALS)) >= FUNDING_UNITS) {
      console.log(`  [wallet] ${rec.public.slice(0, 8)}… already funded`);
      return;
    }
  } catch {
    /* fall through and send anyway */
  }
  const account = await soroban.getAccount(adminAddress);
  const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      usdc.call("transfer", Address.fromString(adminAddress).toScVal(), Address.fromString(rec.public).toScVal(), i128(FUNDING_UNITS))
    )
    .setTimeout(60)
    .build();
  const simulated = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) throw new Error(`usdc transfer sim failed: ${simulated.error}`);
  const assembled = rpc.assembleTransaction(tx, simulated).build();
  assembled.sign(admin);
  const res = await soroban.sendTransaction(assembled);
  if (res.status === "ERROR") throw new Error(`usdc transfer failed: ${JSON.stringify(res.errorResult)}`);
  rec.fundingTx = res.hash;
  await sleep(600);
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

// ---------------------------------------------------------------------------
// Step 2 — groups via factory
// ---------------------------------------------------------------------------

async function createGroup(memberCount: number): Promise<string> {
  const salt = crypto.randomBytes(32);
  const result = await invokeAndPoll(
    FACTORY_ID!,
    "create_group",
    [
      Address.fromString(adminAddress).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(salt)),
      Address.fromString(USDC_CONTRACT_ID!).toScVal(),
      xdr.ScVal.scvU64(new xdr.Uint64(CONTRIBUTION_UNITS)),
      xdr.ScVal.scvU32(memberCount),
      xdr.ScVal.scvU32(CYCLES),
      xdr.ScVal.scvU32(0), // min_attestation_score — open onboarding tier
      xdr.ScVal.scvU32(0), // min_reputation_for_bid — first-cycle bidding allowed
    ],
    admin
  );
  // Fetch the newly created group from factory.get_user_groups(admin).
  void result;
  const account = await soroban.getAccount(adminAddress);
  const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(factory.call("get_user_groups", Address.fromString(adminAddress).toScVal()))
    .setTimeout(30)
    .build();
  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`get_user_groups failed: ${sim.error}`);
  const vec = sim.result?.retval?.vec();
  if (!vec || vec.length === 0) throw new Error("factory returned no groups");
  const last = vec[vec.length - 1].address().toString();
  console.log(`[group] created ${last} (${memberCount} seats, ${CYCLES} cycles, ${CONTRIBUTION_USDC} USDC/cycle)`);
  return last;
}

// ---------------------------------------------------------------------------
// Step 3 — lifecycle drivers
// ---------------------------------------------------------------------------

async function memberCount(groupId: string): Promise<number> {
  const account = await soroban.getAccount(adminAddress);
  const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(groupId).call("get_members"))
    .setTimeout(30)
    .build();
  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`get_members failed: ${sim.error}`);
  const vec = sim.result?.retval?.vec();
  return vec ? vec.length : 0;
}

function commitmentFor(amount: bigint, nonce: bigint): xdr.ScVal {
  const h = crypto.createHash("sha256");
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(amount, 0);
  buf.writeBigUInt64LE(nonce, 8);
  h.update(buf);
  const digest = h.digest(); // 32 bytes
  return xdr.ScVal.scvVec(Array.from(digest).map((b) => xdr.ScVal.scvU32(b)));
}

/** Deterministic distinct bids: linear spread inside [15%, 75%] of contribution. */
function bidAmountFor(index: number, total: number): bigint {
  const hundred = BigInt(100);
  const lo = (CONTRIBUTION_UNITS * BigInt(15)) / hundred;
  const hi = (CONTRIBUTION_UNITS * BigInt(75)) / hundred;
  const span = hi - lo;
  const step = span / BigInt(total);
  const amt = lo + step * BigInt(index % total);
  return amt > BigInt(0) ? amt : BigInt(1);
}

function scU64(v: bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(new xdr.Uint64(v));
}

// ---------------------------------------------------------------------------
// Ledger output
// ---------------------------------------------------------------------------

function writeLedger(groups: { id: string; members: UserRecord[] }[]): void {
  const rows: string[] = [
    "#,wallet_address,group_contract,fund_tx,join_tx,joined_date,status",
  ];
  let n = 0;
  for (const g of groups) {
    for (const m of g.members) {
      n += 1;
      rows.push(
        [n, m.public, g.id, m.fundingTx ?? "", m.joinTx ?? "", new Date().toISOString().slice(0, 10), "onboarded"].join(",")
      );
    }
  }
  fs.writeFileSync(LEDGER_FILE, rows.join("\n") + "\n");
  console.log(`\n[ledger] wrote ${n} users → ${LEDGER_FILE}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`ChainChit committee provisioning — ${TOTAL_USERS} users, groups of ${GROUP_SIZE}, ${CYCLES} cycles, testnet`);
  console.log(`admin: ${adminAddress}\n`);

  const keyStore = loadKeyStore();

  // 1) Ensure wallet roster
  const roster: UserRecord[] = [];
  for (let i = 0; i < TOTAL_USERS; i++) {
    const existing = Object.values(keyStore)[i];
    const rec: UserRecord = existing ?? { secret: Keypair.random().secret(), public: "" };
    if (!rec.public) rec.public = Keypair.fromSecret(rec.secret).publicKey();
    keyStore[rec.public] = rec;
    roster.push(rec);
  }
  saveKeyStore(keyStore);

  console.log("[phase 1/3] provisioning wallets");
  for (const rec of roster) {
    try {
      await ensureWallet(rec);
      await fundUserUsdc(rec);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ERROR wallet ${rec.public}: ${msg}`);
      process.exitCode = 1;
    }
    saveKeyStore(keyStore);
  }

  // 2) Create groups sized to available healthy wallets
  const healthy: UserRecord[] = [];
  for (const r of roster) {
    if (r.trustlineTx !== undefined || (await hasUsdcTrustline(r.public))) healthy.push(r);
  }
  console.log(`\n[phase 2/3] creating groups (${healthy.length} usable wallets)`);
  const chunks: UserRecord[][] = [];
  for (let i = 0; i < healthy.length; i += GROUP_SIZE) {
    chunks.push(healthy.slice(i, i + GROUP_SIZE));
  }
  const groups: { id: string; members: UserRecord[] }[] = [];
  for (const chunk of chunks) {
    if (chunk.length < 2) continue; // contract requires num_members >= 2
    const id = await createGroup(chunk.length);
    groups.push({ id, members: chunk });
    await sleep(800);
  }

  // 3) Drive lifecycle
  console.log("\n[phase 3/3] driving group lifecycles");
  for (const g of groups) {
    console.log(`[group] ${g.id} — ${g.members.length} members`);
    const before = await memberCount(g.id);
    if (before >= g.members.length && before > 0) {
      console.log("  members already joined (resume) — skipping joins");
    } else {
      for (const m of g.members) {
        const kp = Keypair.fromSecret(m.secret);
        console.log(`  [join] ${m.public.slice(0, 8)}…`);
        try {
          m.joinTx = await invokeAndPoll(g.id, "join_group", [Address.fromString(m.public).toScVal()], kp);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("AlreadyMember")) continue;
          throw e;
        }
        await sleep(400);
      }
    }
    await driveGroupLifecycleResumeAware(g.id, g.members);
    saveKeyStore(keyStore);
  }

  writeLedger(groups);
  console.log("\nDone. Next steps:");
  console.log("  1. Commit docs/users_testnet.csv (addresses + tx hashes only — never secrets)");
  console.log("  2. Copy rows into docs/USERS.md ledger");
  console.log("  3. Screenshot Stellar Expert pages for each group as activity proof");
}

/** Lifecycle with resume tolerance: skip already-paid/bid members on re-run. */
async function driveGroupLifecycleResumeAware(groupId: string, members: UserRecord[]): Promise<void> {
  const joined = await memberCount(groupId);

  // Determine whether collection already started by probing pay_contribution simulation.
  async function phaseAllowsPay(): Promise<boolean> {
    try {
      const kp = Keypair.fromSecret(members[0].secret);
      const account = await soroban.getAccount(kp.publicKey());
      const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
        .addOperation(
          new Contract(groupId).call("pay_contribution", Address.fromString(kp.publicKey()).toScVal())
        )
        .setTimeout(30)
        .build();
      const sim = await soroban.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(sim)) {
        // NotCollecting vs AlreadyPaid vs NotMember all surface here
        return !sim.error.includes("NotCollecting") && !sim.error.includes("Error");
      }
      return true;
    } catch {
      return false;
    }
  }

  const collecting = await phaseAllowsPay();
  if (!collecting && joined === members.length) {
    console.log("  group already past Forming (resume)");
  } else {
    console.log("  [cycle] start_collection");
    try {
      await invokeAndPoll(groupId, "start_collection", [Address.fromString(adminAddress).toScVal()], admin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("NotForming")) throw e;
    }
  }

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    if (cycle > 1) {
      console.log(`  [cycle] advance_cycle → ${cycle}`);
      await invokeAndPoll(groupId, "advance_cycle", [Address.fromString(adminAddress).toScVal()], admin);
    }

    for (const m of members) {
      const kp = Keypair.fromSecret(m.secret);
      console.log(`  [pay ] cycle ${cycle} — ${m.public.slice(0, 8)}…`);
      try {
        await invokeAndPoll(groupId, "pay_contribution", [Address.fromString(m.public).toScVal()], kp);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("AlreadyPaid")) continue;
        throw e;
      }
      await sleep(400);
    }

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const kp = Keypair.fromSecret(m.secret);
      const amount = bidAmountFor(i, members.length);
      const nonce = BigInt.asUintN(64, crypto.randomBytes(8).readBigUInt64LE(0));
      console.log(`  [bid ] commit+reveal cycle ${cycle} — ${m.public.slice(0, 8)}… amount=${Number(amount) / USDC_DECIMALS}`);
      try {
        await invokeAndPoll(groupId, "commit_bid", [Address.fromString(m.public).toScVal(), commitmentFor(amount, nonce)], kp);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("AlreadyCommitted")) throw e;
      }
      await invokeAndPoll(groupId, "reveal_bid", [Address.fromString(m.public).toScVal(), scU64(amount), scU64(nonce)], kp);
      await sleep(400);
    }

    console.log(`  [payout] cycle ${cycle}`);
    try {
      await invokeAndPoll(groupId, "execute_payout", [], admin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("NotBidding")) throw e;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
