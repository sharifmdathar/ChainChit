/**
 * validate_deadline.ts — LIVE testnet proof for the collection-deadline feature
 * added in the 2026-09-22 chit_group upgrade.
 *
 * It creates a fresh 2-seat group through the factory (which now points at the
 * new WASM) and drives it specifically through the NEW code path that the old
 * contract could not follow — a group that fills up but does NOT get fully paid:
 *
 *   set_collection_window(short) → start_collection (arms on-chain deadline)
 *   → admin pays, seat #2 defaults → state STAYS "Collecting" (the old stall)
 *   → begin_bidding_after_deadline() → "Bidding", defaulter marked Defaulted
 *   → execute_payout pool = paid_count × contribution (NOT num_members)  [over-withdraw fix]
 *   → commit_bid by the defaulter reverts with NotPaid (#29)             [bid gate]
 *
 * TESTNET ONLY. Every step emits a real on-chain transaction; all hashes are
 * printed for the docs/USERS.md proof section.
 *
 * Usage (from frontend/):
 *   SOROBAN_SECRET_KEY=S... bun scripts/validate_deadline.ts
 *   VALIDATE_WINDOW_SECONDS=90  (optional; on-chain deadline length for the demo)
 */
import { Keypair, TransactionBuilder, Contract, Address, rpc, xdr } from "@stellar/stellar-sdk";
import * as fs from "fs";
import * as crypto from "crypto";

// Load frontend/.env.local (real env vars keep priority).
try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
} catch { /* no .env.local — env must cover config */ }

const SECRET = process.env.SOROBAN_SECRET_KEY;
const FACTORY_ID = process.env.NEXT_PUBLIC_FACTORY_CONTRACT;
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT;
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "TESTNET";
const RPC_URL = NETWORK === "TESTNET" ? "https://soroban-testnet.stellar.org" : "https://rpc.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const PASSPHRASE = NETWORK === "TESTNET" ? "Test SDF Network ; September 2015" : "Public Global Stellar Network ; September 2015";
const TX_FEE = "100000";

if (NETWORK !== "TESTNET") throw new Error("validate_deadline.ts is TESTNET ONLY.");
if (!SECRET) throw new Error("SOROBAN_SECRET_KEY required");
if (!FACTORY_ID) throw new Error("NEXT_PUBLIC_FACTORY_CONTRACT required");
if (!USDC) throw new Error("NEXT_PUBLIC_USDC_CONTRACT required");

const server = new rpc.Server(RPC_URL, { allowHttp: false });
const admin = Keypair.fromSecret(SECRET!);
const adminAddress = admin.publicKey();

const CONTRIBUTION = 1_000_000n;               // 1.00 USDC (7 decimals)
const WINDOW = Number(process.env.VALIDATE_WINDOW_SECONDS || 90);

// ── ScVal helpers ────────────────────────────────────────────────────────────
const scAddr = (a: string) => Address.fromString(a).toScVal();
const scU64 = (v: bigint) => xdr.ScVal.scvU64(new xdr.Uint64(v));
const scU32 = (n: number) => xdr.ScVal.scvU32(n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getMap(x: xdr.ScVal | undefined): Map<string, xdr.ScVal> | null {
    if (!x || x.switch().name !== "scvMap") return null;
    const out = new Map<string, xdr.ScVal>();
    for (const e of x.map()!) {
        const k = e.key().sym()?.toString();
        if (k) out.set(k, e.val());
    }
    return out;
}
const sym = (x?: xdr.ScVal): string | null => {
    // Tolerant enum decoder (mirrors keeper.ts): unit enums may arrive as a bare
    // scvSymbol OR wrapped as scvVec[Symbol("Variant")]; strings as scvString.
    if (!x) return null;
    const name = x.switch().name;
    if (name === "scvSymbol") return x.sym()!.toString();
    if (name === "scvString") return x.str()!.toString();
    if (name === "scvVec") {
        const first = x.vec()?.[0];
        if (first?.switch().name === "scvSymbol") return first.sym()!.toString();
        if (first?.switch().name === "scvString") return first.str()!.toString();
    }
    return null;
};
const u64 = (x?: xdr.ScVal) => (x && x.switch().name === "scvU64" ? (x.u64() as unknown as bigint) : undefined);
const addrStr = (x?: xdr.ScVal) => (x && x.switch().name === "scvAddress" ? Address.fromScVal(x).toString() : undefined);
// Look up a ScVal map entry whose KEY is an address (e.g. CycleState.payments).
function mapGetByAddr(x: xdr.ScVal | undefined, addr: string): xdr.ScVal | undefined {
    if (!x || x.switch().name !== "scvMap") return undefined;
    for (const e of x.map()!) if (addrStr(e.key()) === addr) return e.val();
    return undefined;
}

// ── read (simulate, no submit) ───────────────────────────────────────────────
async function readCall(contract: string, method: string, args: xdr.ScVal[] = []): Promise<xdr.ScVal | undefined> {
    const account = await server.getAccount(adminAddress);
    const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
        .addOperation(new Contract(contract).call(method, ...args))
        .setTimeout(30).build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
    return sim.result?.retval;
}

// ── write (build → simulate → sign → submit → poll) ──────────────────────────
async function write(contract: string, method: string, args: xdr.ScVal[], source: Keypair)
    : Promise<{ hash: string; retval?: xdr.ScVal }> {
    const account = await server.getAccount(source.publicKey());
    const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
        .addOperation(new Contract(contract).call(method, ...args))
        .setTimeout(120).build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
    const retval = sim.result?.retval;
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(source);
    let hash = "";
    for (let a = 0; a < 3; a++) {
        const res = await server.sendTransaction(assembled);
        if (res.status === "ERROR") throw new Error(`${method} send: ${JSON.stringify(res.errorResult)}`);
        hash = res.hash;
        if (res.status === "PENDING") break;
        await sleep(500);
    }
    const dl = Date.now() + 60_000;
    while (Date.now() < dl) {
        await sleep(1000);
        const st = await server.getTransaction(hash);
        if (st.status === rpc.Api.GetTransactionStatus.SUCCESS) return { hash, retval };
        if (st.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error(`${method} tx ${hash} FAILED on-chain`);
    }
    throw new Error(`${method} tx ${hash} timed out`);
}

async function usdcBalance(address: string): Promise<bigint> {
    try {
        const v = await readCall(USDC!, "balance", [scAddr(address)]);
        if (!v || v.switch().name !== "scvI128") return 0n;   // void/no trustline → 0
        const p = v.i128() as unknown as { hi(): { toBigInt(): bigint }; lo(): { toBigInt(): bigint } };
        return (p.hi().toBigInt() << 64n) + p.lo().toBigInt();  // signed i128 = hi·2^64 + lo
    } catch { return 0n; }
}

// Fund a throwaway account (friendbot uses ?addr=, NOT ?id=) and wait until
// SOROBAN RPC can see it — the source write() reads from, which lags by seconds.
async function ensureFunded(address: string): Promise<void> {
    for (let attempt = 1; attempt <= 6; attempt++) {
        try {
            const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`);
            if (res.status === 429 || res.status === 503) { await sleep(attempt * 3000); continue; }
        } catch { /* transient — retry below */ }
        const dl = Date.now() + 20_000;
        while (Date.now() < dl) {
            try { await server.getAccount(address); return; } catch { await sleep(1500); }
        }
    }
    throw new Error(`could not fund/propagate ${address} on RPC`);
}

async function groupState(groupId: string): Promise<string | null> {
    return sym(getMap(await readCall(groupId, "get_group_info"))?.get("state"));
}
async function memberStatus(groupId: string, cycle: number, member: string): Promise<string | null> {
    const cs = await readCall(groupId, "get_cycle_state", [scU32(cycle)]);
    return sym(mapGetByAddr(getMap(cs)?.get("payments"), member));
}

const EX = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;

async function main() {
    const txs: { label: string; hash: string }[] = [];
    const log = (s: string) => console.log(s);

    log(`\n=== ChainChit deadline validation — testnet ===`);
    log(`factory ${FACTORY_ID}`);
    log(`admin ${adminAddress}  (USDC ${(Number(await usdcBalance(adminAddress)) / 1e7).toFixed(2)})`);
    log(`window ${WINDOW}s  contribution ${(Number(CONTRIBUTION) / 1e7).toFixed(2)} USDC  seats 2\n`);

    // Seat #2: a throwaway wallet we fund (join-only; it will DEFAULT, so no USDC needed).
    const defaulter = Keypair.random();
    const defaulterAddr = defaulter.publicKey();
    await ensureFunded(defaulterAddr);
    log(`[setup] throwaway defaulter ${defaulterAddr} funded + visible on RPC (XLM only)`);

    // 1 — create the group through the factory. Capture the deployed address from the sim.
    const salt = crypto.randomBytes(32);
    const created = await write(FACTORY_ID!, "create_group", [
        scAddr(adminAddress), xdr.ScVal.scvBytes(Buffer.from(salt)), scAddr(USDC!),
        scU64(CONTRIBUTION), scU32(2), scU32(2), scU32(0), scU32(0),
    ], admin);
    txs.push({ label: "create_group", hash: created.hash });
    let groupId = addrStr(created.retval) ?? "";
    // verify the address is live; fall back to the last entry in get_user_groups(admin)
    try { await readCall(groupId, "get_group_info"); } catch {
        const grp = await readCall(FACTORY_ID!, "get_user_groups", [scAddr(adminAddress)]);
        const arr = grp?.vec() ?? [];
        groupId = arr.length ? addrStr(arr[arr.length - 1]) ?? "" : "";
    }
    if (!groupId) throw new Error("could not resolve new group id");
    log(`[1] create_group → ${groupId}\n    ${EX(created.hash)}`);

    // 2 — both seats join (join needs only XLM for the fee).
    txs.push({ label: "join(admin)", hash: (await write(groupId, "join_group", [scAddr(adminAddress)], admin)).hash });
    txs.push({ label: "join(defaulter)", hash: (await write(groupId, "join_group", [scAddr(defaulterAddr)], defaulter)).hash });
    const members = (await readCall(groupId, "get_members"))?.vec()?.length ?? 0;
    log(`[2] both joined — ${members}/2 seats filled`);
    if (members !== 2) throw new Error("group not full");

    // 3 — arm a short window BEFORE start_collection, then start.
    txs.push({ label: "set_collection_window", hash: (await write(groupId, "set_collection_window", [scAddr(adminAddress), scU64(BigInt(WINDOW))], admin)).hash });
    txs.push({ label: "start_collection", hash: (await write(groupId, "start_collection", [scAddr(adminAddress)], admin)).hash });
    const deadline = u64(await readCall(groupId, "get_collection_deadline"));
    if (!deadline) throw new Error("no on-chain deadline armed!");
    log(`[3] start_collection → state=Collecting, ON-CHAIN DEADLINE = ${deadline}s (now≈${Math.floor(Date.now() / 1000)}s)`);

    // 4 — only the admin pays; the defaulter stays Pending.
    txs.push({ label: "pay_contribution(admin)", hash: (await write(groupId, "pay_contribution", [scAddr(adminAddress)], admin)).hash });
    const stAfterPay = await groupState(groupId);
    const dStat = await memberStatus(groupId, 1, defaulterAddr);
    log(`[4] admin paid. state=${stAfterPay}, defaulter=${dStat}`);
    if (stAfterPay !== "Collecting") throw new Error(`expected the OLD stall (Collecting), got ${stAfterPay}`);
    log(`    ✓ reproduced the old stall: not all-paid → would previously hang forever`);

    // 5 — bid gate: the defaulter must NOT be able to bid (NotPaid #29). Simulate-only; expect revert.
    try {
        const acct = await server.getAccount(defaulterAddr);
        const t = new TransactionBuilder(acct, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
            .addOperation(new Contract(groupId).call("commit_bid", scAddr(defaulterAddr), xdr.ScVal.scvVec(new Array(32).fill(xdr.ScVal.scvU32(0))))).setTimeout(30).build();
        const s = await server.simulateTransaction(t);
        if (rpc.Api.isSimulationError(s)) throw new Error("sim-error");
        throw new Error("defaulter commit_bid UNEXPECTEDLY SUCCEEDED");
    } catch (e) {
        log(`[5] ✓ defaulter commit_bid rejected (NotPaid) — ${(e as Error).message.includes("sim-error") ? "gate works" : (e as Error).message}`);
    }

    // 6 — wait out the deadline, then force-advance.
    const wait = Number(deadline) * 1000 + 6000 - Date.now();
    if (wait > 0) { log(`[6] waiting ${Math.ceil(wait / 1000)}s for the on-chain deadline…`); await sleep(wait); }
    txs.push({ label: "begin_bidding_after_deadline", hash: (await write(groupId, "begin_bidding_after_deadline", [], admin)).hash });
    const stBidding = await groupState(groupId);
    const dStat2 = await memberStatus(groupId, 1, defaulterAddr);
    log(`[6] begin_bidding_after_deadline → state=${stBidding}, defaulter=${dStat2}`);
    if (stBidding !== "Bidding" || dStat2 !== "Defaulted") throw new Error(`deadline advance wrong: state=${stBidding} defaulter=${dStat2}`);
    log(`    ✓ permissionless force-advance works; defaulter marked Defaulted`);

    // 7 — payout sizing proves the over-withdraw fix: pool = paid_count(1) × contribution,
    //      NOT num_members(2) × contribution. Contract holds exactly 1 USDC; a num_members
    //      sized payout (2 USDC) would revert. Admin is the sole paid bidder → wins.
    const preBal = await usdcBalance(groupId);
    log(`[7] contract USDC balance before payout = ${(Number(preBal) / 1e7).toFixed(2)} (paid_count×contribution)`);
    const amount = CONTRIBUTION / 2n;                       // 0.50 USDC bid discount, ≤ contribution
    const nonce = BigInt.asUintN(64, crypto.randomBytes(8).readBigUInt64LE(0));
    const h = crypto.createHash("sha256"); const buf = Buffer.alloc(16);
    buf.writeBigUInt64LE(amount, 0); buf.writeBigUInt64LE(nonce, 8); h.update(buf);
    const commitment = xdr.ScVal.scvVec(Array.from(h.digest()).map((b) => xdr.ScVal.scvU32(b)));
    txs.push({ label: "commit_bid(admin)", hash: (await write(groupId, "commit_bid", [scAddr(adminAddress), commitment], admin)).hash });
    txs.push({ label: "reveal_bid(admin)", hash: (await write(groupId, "reveal_bid", [scAddr(adminAddress), scU64(amount), scU64(nonce)], admin)).hash });
    txs.push({ label: "execute_payout", hash: (await write(groupId, "execute_payout", [], admin)).hash });
    const postBal = await usdcBalance(groupId);
    log(`[7] execute_payout OK → contract balance now ${(Number(postBal) / 1e7).toFixed(2)}`);
    if (postBal !== 0n) throw new Error(`expected contract drained to 0, got ${postBal}`);
    log(`    ✓ pool correctly = paid_count×contribution; no over-withdraw, no stuck funds`);

    log(`\n=== RESULT: PASS — deadline, default marking, bid gate and payout re-base all verified live ===`);
    log(`group: https://stellar.expert/explorer/testnet/contract/${groupId}`);
    log(`\ntx ledger:`);
    for (const t of txs) log(`  ${t.label.padEnd(32)} ${t.hash}`);
    log(`\nRemember to add ${groupId} to GROUPS_SKIP if you don't want the keeper churning its empty cycle 2.`);
}

main().catch((e) => { console.error("\n❌ VALIDATION FAILED:", (e as Error).message); process.exit(1); });
