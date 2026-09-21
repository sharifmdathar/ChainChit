/**
 * keeper.ts — Phase Transition Keeper for ChainChit chit groups.
 *
 * A chit fund stalls if nobody is online to move it forward. Members pay, bid
 * and reveal on their own schedule, but the *state transitions* still need a
 * caller:
 *
 *   Forming   → Collecting   start_collection()             (ADMIN only, group must be full)
 *   Collecting→ Bidding      automatic                      (fires inside pay_contribution once ALL pay)
 *                            begin_bidding_after_deadline() (PERMISSIONLESS once the on-chain collection
 *                                                           deadline passes; marks non-payers Defaulted)
 *   Bidding   → Payout       execute_payout()               (PERMISSIONLESS, needs ≥1 revealed unique bid)
 *   Payout    → next cycle   advance_cycle()                (ADMIN only)
 *
 * This keeper is a "foreman bot": on every tick it walks the groups it is told
 * to watch, and for any group parked long enough in a transitional state it
 * performs the next legal transition. `execute_payout` is the headline win — it
 * is permissionless, so the keeper moves pooled funds to cycle winners even
 * when no human is watching. `start_collection`/`advance_cycle` are admin-gated
 * and only run when the keeper key *is* the group admin.
 *
 * The chit_group contract now arms an on-chain `collection_deadline` on every
 * start_collection/advance_cycle. For Collecting groups the keeper reads that
 * deadline (get_collection_deadline) and, once it has passed, calls the
 * permissionless begin_bidding_after_deadline() to force the cycle forward — so
 * a member who never pays no longer stalls the group forever; they are marked
 * Defaulted and the pool is sized to the members who actually paid. Groups
 * deployed *before* that feature have no on-chain deadline; for those the
 * keeper falls back to its own wall-clock and can only *report* a Collecting
 * stall (it cannot force-advance them). Dwell windows below apply to the
 * off-chain transitions (join grace, bidding dwell, payout cooldown).
 *
 * Usage (from frontend/):
 *   # one-shot sweep — pair with Vercel Cron / GitHub Actions `schedule:`
 *   npx tsx scripts/keeper.ts --once
 *
 *   # long-running daemon (local dev), sweep every 60s
 *   npx tsx scripts/keeper.ts --interval 60
 *
 *   # dry run (log intended actions, submit nothing)
 *   npx tsx scripts/keeper.ts --once --dry-run
 *
 * Required env (see frontend/.env.local.example):
 *   SOROBAN_SECRET_KEY          signer; must be group admin to start/advance
 *   NEXT_PUBLIC_NETWORK         TESTNET | PUBLIC | MAINNET
 *   NEXT_PUBLIC_FACTORY_CONTRACT (used to auto-discover the admin's groups)
 *
 * Optional env:
 *   GROUPS                      comma list of group ids to watch (overrides discovery)
 *   GROUPS_SKIP                 comma list of group ids to IGNORE even if discovered
 *                               (e.g. deliberately-unfunded join-only cohorts)
 *   JOIN_GRACE_MINUTES          dwell in Forming once full before starting   (default 30)
 *   COLLECTION_WINDOW_HOURS     fallback stall alert for legacy groups w/o on-chain
 *                               deadline                                    (default 48)
 *   BIDDING_WINDOW_HOURS        dwell before execute_payout fires             (default 12)
 *   PAYOUT_COOLDOWN_MINUTES     dwell in Payout before advance_cycle fires    (default 10)
 *
 * Outputs:
 *   frontend/.keeper-state.local.json   (gitignored — per-group dwell timers)
 */
import {
    Keypair,
    TransactionBuilder,
    Contract,
    Address,
    Account,
    rpc,
    xdr,
} from "@stellar/stellar-sdk";
import * as fs from "fs";

// Load frontend/.env.local (KEY=VALUE lines); real env vars keep priority.
try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
} catch {
    /* no .env.local — rely on real env vars */
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECRET = process.env.SOROBAN_SECRET_KEY;
const FACTORY_ID =
    process.env.NEXT_PUBLIC_FACTORY_CONTRACT || process.env.NEXT_PUBLIC_CONTRACT_FACTORY;
const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "TESTNET").toUpperCase();

const IS_TESTNET = NETWORK === "TESTNET";
const RPC_URL =
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
    (IS_TESTNET ? "https://soroban-testnet.stellar.org" : "https://rpc.stellar.org");
const PASSPHRASE = IS_TESTNET
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";

if (!SECRET) throw new Error("SOROBAN_SECRET_KEY env var required");
if (!FACTORY_ID && !process.env.GROUPS) {
    throw new Error("Set NEXT_PUBLIC_FACTORY_CONTRACT (for admin group discovery) or GROUPS (explicit list)");
}

// CLI flags
const argv = process.argv.slice(2);
const hasFlag = (name: string) => argv.includes(`--${name}`);
function numFlag(name: string, fallback: number): number {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return fallback;
    const v = Number(argv[i + 1]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

const RUN_ONCE = hasFlag("once");
const DRY_RUN = hasFlag("dry-run");
const CHECK_ONLY = hasFlag("check");
const INTERVAL_SEC = numFlag("interval", 60);

// Dwell windows (wall-clock) before the keeper acts.
const MIN = 60_000;
const HOUR = 60 * MIN;
function envNum(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === "") return fallback;
    const v = Number(raw);
    // Dwell windows are legitimately 0 (= act immediately); reject only
    // non-numeric or negative input.
    return Number.isFinite(v) && v >= 0 ? v : fallback;
}
const JOIN_GRACE_MS = envNum("JOIN_GRACE_MINUTES", 30) * MIN;
const COLLECTION_WINDOW_MS = envNum("COLLECTION_WINDOW_HOURS", 48) * HOUR;
const BIDDING_WINDOW_MS = envNum("BIDDING_WINDOW_HOURS", 12) * HOUR;
const PAYOUT_COOLDOWN_MS = envNum("PAYOUT_COOLDOWN_MINUTES", 10) * MIN;

// Group ids to ignore even if admin-discovered — the timer-targeting guard for
// deliberately-unfunded cohorts (e.g. join-only demos) so the keeper never
// start_collection's them into a stall. Case-insensitive, comma separated.
const SKIP_GROUPS = new Set(
    (process.env.GROUPS_SKIP || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
);

const TX_FEE = "1000000"; // covers cross-contract reputation calls
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

const STATE_FILE = ".keeper-state.local.json";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Persistence — per-group dwell timers (keyed by group id; cycle+state stored inside)
// ---------------------------------------------------------------------------

interface GroupTrack {
    cycle: number;
    state: string;
    firstSeenMs: number;
}
type KeeperState = Record<string, GroupTrack>;

function loadState(): KeeperState {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as KeeperState;
    } catch {
        return {};
    }
}

function saveState(state: KeeperState): void {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Low-level Soroban helpers
// ---------------------------------------------------------------------------

const soroban = new rpc.Server(RPC_URL);
const keeper = Keypair.fromSecret(SECRET!);
const keeperAddress = keeper.publicKey();

/** Read-only call: simulate and return the decoded retval ScVal. */
async function readCall(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = []
): Promise<xdr.ScVal> {
    // Reads never touch the ledger balance/auth, so use a synthetic source
    // account (sequence 0) instead of getAccount — this lets the keeper monitor
    // groups even when its own address is unfunded or on a fresh network.
    const account = new Account(keeperAddress, "0");
    const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
        .addOperation(new Contract(contractId).call(method, ...args))
        .setTimeout(0)
        .build();
    const sim = await soroban.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
        throw new Error(`${method} sim failed: ${sim.error}`);
    }
    if (!sim.result) throw new Error(`${method}: no simulation result`);
    return sim.result.retval;
}

/** Write call: build, simulate, sign, submit, poll to success. Returns tx hash. */
async function writeCall(
    contractId: string,
    method: string,
    args: xdr.ScVal[]
): Promise<string> {
    if (DRY_RUN) {
        console.log(`    [dry-run] would invoke ${method} on ${contractId}`);
        return "dry-run";
    }
    let account;
    try {
        account = await soroban.getAccount(keeperAddress);
    } catch {
        throw new Error(
            `${method}: keeper account ${keeperAddress} is not funded on ${NETWORK} — ` +
            `writes need XLM for fees (reads/dry-run do not).`
        );
    }
    const tx = new TransactionBuilder(account, { fee: TX_FEE, networkPassphrase: PASSPHRASE })
        .addOperation(new Contract(contractId).call(method, ...args))
        .setTimeout(120)
        .build();
    const sim = await soroban.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
        throw new Error(`${method} sim failed: ${sim.error}`);
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();
    assembled.sign(keeper);

    let hash = "";
    for (let attempt = 0; attempt < 3; attempt++) {
        const sent = await soroban.sendTransaction(assembled);
        if (sent.status === "ERROR") {
            throw new Error(`${method} send failed: ${JSON.stringify(sent.errorResult)}`);
        }
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
            /* transient RPC hiccup — keep polling */
        }
    }
    throw new Error(`${method} tx ${hash} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

// ---------------------------------------------------------------------------
// ScVal decoding (minimal, group-info / members / cycle-payments only)
// ---------------------------------------------------------------------------

function mapEntries(val: xdr.ScVal): xdr.ScMapEntry[] {
    const m = val.map();
    if (!m) throw new Error("expected ScVal map");
    return m;
}

function getMap(val: xdr.ScVal, key: string): xdr.ScVal | undefined {
    return mapEntries(val).find(
        (e) => e.key().switch().name === "scvSymbol" && e.key().sym().toString() === key
    )?.val();
}

function sym(val: xdr.ScVal): string {
    // Tolerant contract-enum decoder (mirrors the frontend scValToString):
    // unit enums may arrive as scvSymbol, enums-with-data as scvVec[Symbol,…],
    // and stringy fields as scvString.
    const name = val.switch().name;
    if (name === "scvSymbol") return val.sym().toString();
    if (name === "scvString") return val.str().toString();
    if (name === "scvVec") {
        const first = val.vec()?.[0];
        if (first?.switch().name === "scvSymbol") return first.sym().toString();
        if (first?.switch().name === "scvString") return first.str().toString();
    }
    throw new Error(`expected enum symbol, got ${name}`);
}
function u32(val: xdr.ScVal): number {
    return val.u32();
}
function u64(val: xdr.ScVal): bigint {
    return BigInt(val.u64().toString());
}
function addr(val: xdr.ScVal): string {
    return Address.fromScVal(val).toString();
}
function vecLen(val: xdr.ScVal): number {
    return val.vec()?.length ?? 0;
}

interface GroupInfoLite {
    admin: string;
    token: string;
    contributionAmount: bigint;
    numMembers: number;
    totalCycles: number;
    currentCycle: number;
    state: string;
}

function decodeGroupInfo(val: xdr.ScVal): GroupInfoLite {
    return {
        admin: addr(getMap(val, "admin")!),
        token: addr(getMap(val, "token")!),
        contributionAmount: u64(getMap(val, "contribution_amount")!),
        numMembers: u32(getMap(val, "num_members")!),
        totalCycles: u32(getMap(val, "total_cycles")!),
        currentCycle: u32(getMap(val, "current_cycle")!),
        state: sym(getMap(val, "state")!),
    };
}

/** payments map → { paid, unpaid: [addresses] } for a given cycle. */
function decodeCyclePayments(
    cycleVal: xdr.ScVal
): { paid: number; unpaid: string[] } {
    const paymentsVal = getMap(cycleVal, "payments");
    if (!paymentsVal || paymentsVal.switch().name !== "scvMap") {
        return { paid: 0, unpaid: [] };
    }
    let paid = 0;
    const unpaid: string[] = [];
    for (const entry of paymentsVal.map()!) {
        const member = addr(entry.key());
        const status = sym(entry.val());
        if (status === "Paid") paid += 1;
        else unpaid.push(`${member.slice(0, 8)}…(${status})`);
    }
    return { paid, unpaid };
}

// ---------------------------------------------------------------------------
// Group discovery
// ---------------------------------------------------------------------------

async function discoverGroups(): Promise<string[]> {
    const applySkip = (ids: string[]) => ids.filter((id) => !SKIP_GROUPS.has(id.toUpperCase()));
    const explicit = (process.env.GROUPS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (explicit.length > 0) return applySkip(explicit);

    // Enumerate the keeper/admin's created groups from the factory.
    const retval = await readCall(FACTORY_ID!, "get_user_groups", [
        Address.fromString(keeperAddress).toScVal(),
    ]);
    return applySkip(retval.vec()?.map((v) => addr(v)) ?? []);
}

// ---------------------------------------------------------------------------
// Per-group state machine
// ---------------------------------------------------------------------------

/** True when a simulation/tx error message means "already advanced" — benign. */
function isBenign(msg: string, codes: string[]): boolean {
    return codes.some((c) => msg.includes(c));
}

async function processGroup(groupId: string, tracked: KeeperState): Promise<void> {
    let info: GroupInfoLite;
    try {
        info = decodeGroupInfo(await readCall(groupId, "get_group_info"));
    } catch (e) {
        console.warn(`  ${groupId}: unreadable (${e instanceof Error ? e.message : e}) — skipping`);
        return;
    }

    if (info.state === "Completed" || info.state === "Paused") {
        if (tracked[groupId]) {
            delete tracked[groupId];
            console.log(`  ${groupId.slice(0, 8)}…: ${info.state} — dropped from tracking`);
        }
        return;
    }

    // (Re)arm the dwell timer whenever the observed (cycle,state) changes.
    const now = Date.now();
    let t = tracked[groupId];
    if (!t || t.state !== info.state || t.cycle !== info.currentCycle) {
        t = { cycle: info.currentCycle, state: info.state, firstSeenMs: now };
        tracked[groupId] = t;
    }
    const dwellMs = now - t.firstSeenMs;
    const isKeeperAdmin = info.admin === keeperAddress;
    const tag = `${groupId.slice(0, 8)}…c${info.currentCycle}/${info.state}`;

    switch (info.state) {
        case "Forming": {
            const members = vecLen(await readCall(groupId, "get_members"));
            if (members < info.numMembers) {
                console.log(`  ${tag} — ${members}/${info.numMembers} joined, waiting`);
                return;
            }
            if (dwellMs < JOIN_GRACE_MS) {
                console.log(`  ${tag} — full (${members}), grace ${Math.round(dwellMs / MIN)}m/${JOIN_GRACE_MS / MIN}m`);
                return;
            }
            if (!isKeeperAdmin) {
                console.log(`  ${tag} — FULL but admin is ${info.admin.slice(0, 8)}…; keeper cannot start_collection`);
                return;
            }
            console.log(`  ${tag} — group full, calling start_collection`);
            try {
                const h = await writeCall(groupId, "start_collection", [
                    Address.fromString(keeperAddress).toScVal(),
                ]);
                console.log(`    ✓ started: ${h}`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (isBenign(msg, ["#14", "NotForming"])) console.log("    already started");
                else console.error(`    ERROR start_collection: ${msg}`);
            }
            return;
        }

        case "Collecting": {
            // Preferred path: the (post-redeploy) contract arms an on-chain
            // collection deadline. Once it passes, begin_bidding_after_deadline()
            // is permissionless and force-advances, marking non-payers Defaulted
            // and re-basing the payout pool on the members who actually paid.
            let deadline: bigint | null = null;
            try {
                const d = await readCall(groupId, "get_collection_deadline");
                if (d.switch().name === "scvU64") deadline = u64(d);
            } catch {
                deadline = null; // legacy group: method not present on-chain
            }

            if (deadline !== null) {
                const nowSec = BigInt(Math.floor(Date.now() / 1000));
                if (nowSec < deadline) {
                    const leftMin = Number((deadline - nowSec + 59n) / 60n);
                    console.log(`  ${tag} — collecting, on-chain deadline in ~${leftMin}m`);
                    return;
                }
                let detail = "";
                try {
                    const cycleVal = await readCall(groupId, "get_cycle_state", [
                        xdr.ScVal.scvU32(info.currentCycle),
                    ]);
                    const { paid, unpaid } = decodeCyclePayments(cycleVal);
                    detail = ` — ${paid}/${info.numMembers} paid, forcing to Bidding (defaulting ${unpaid.length})`;
                } catch {
                    /* best-effort detail only */
                }
                console.log(`  ${tag} — collection deadline passed${detail}`);
                try {
                    // begin_bidding_after_deadline takes no auth arg — anyone may call.
                    const h = await writeCall(groupId, "begin_bidding_after_deadline", []);
                    console.log(`    ✓ forced to Bidding: ${h}`);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    if (isBenign(msg, ["#15", "NotCollecting"])) console.log("    already past collecting");
                    else if (isBenign(msg, ["#27", "DeadlineNotReached"])) console.log("    deadline not reached yet");
                    else if (isBenign(msg, ["#28", "NothingCollected"]))
                        console.warn(
                            `  ⚠ ${tag}: deadline passed but NO member funded → nothing to advance.\n` +
                            `     → looks like an unfunded/join-only group; add it to GROUPS_SKIP to silence.`
                        );
                    else console.error(`    ERROR begin_bidding_after_deadline: ${msg}`);
                }
                return;
            }

            // Fallback: legacy group with no on-chain deadline — the contract
            // cannot be force-advanced, so this stays an alert, not an action.
            if (dwellMs < COLLECTION_WINDOW_MS) {
                console.log(`  ${tag} — collecting ${Math.round(dwellMs / HOUR * 10) / 10}h/${COLLECTION_WINDOW_MS / HOUR}h (no on-chain deadline)`);
                return;
            }
            let detail = "";
            try {
                const cycleVal = await readCall(groupId, "get_cycle_state", [
                    xdr.ScVal.scvU32(info.currentCycle),
                ]);
                const { paid, unpaid } = decodeCyclePayments(cycleVal);
                detail = ` — ${paid}/${info.numMembers} paid; unpaid: ${unpaid.join(", ") || "none listed"}`;
            } catch (e) {
                detail = ` — (could not read cycle state: ${e instanceof Error ? e.message : e})`;
            }
            console.warn(
                `  ⚠ STALLED ${tag} past ${COLLECTION_WINDOW_MS / HOUR}h${detail}\n` +
                `     → legacy group with no on-chain deadline; nudge payers or resolve via dispute.`
            );
            return;
        }

        case "Bidding": {
            if (dwellMs < BIDDING_WINDOW_MS) {
                console.log(`  ${tag} — bidding ${Math.round(dwellMs / HOUR * 10) / 10}h/${BIDDING_WINDOW_MS / HOUR}h`);
                return;
            }
            console.log(`  ${tag} — bidding window elapsed, executing payout`);
            try {
                // execute_payout takes no auth argument — anyone may call it.
                const h = await writeCall(groupId, "execute_payout", []);
                console.log(`    ✓ payout executed: ${h}`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (isBenign(msg, ["#16", "NotBidding"])) {
                    console.log("    already moved past bidding");
                } else if (isBenign(msg, ["#23", "NoValidBids"])) {
                    console.warn(`  ⚠ ${tag}: no valid unique bid to pay out — bids may be unrevealed`);
                } else {
                    console.error(`    ERROR execute_payout: ${msg}`);
                }
            }
            return;
        }

        case "Payout": {
            if (dwellMs < PAYOUT_COOLDOWN_MS) {
                console.log(`  ${tag} — payout settled ${Math.round(dwellMs / MIN)}m/${PAYOUT_COOLDOWN_MS / MIN}m`);
                return;
            }
            if (!isKeeperAdmin) {
                console.log(`  ${tag} — payout done, admin ${info.admin.slice(0, 8)}… must advance_cycle`);
                return;
            }
            const isLast = info.currentCycle >= info.totalCycles;
            console.log(`  ${tag} — advancing cycle${isLast ? " (final → Completed)" : ""}`);
            try {
                const h = await writeCall(groupId, "advance_cycle", [
                    Address.fromString(keeperAddress).toScVal(),
                ]);
                console.log(`    ✓ advanced: ${h}`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (isBenign(msg, ["#17", "NotPayout"])) console.log("    already advanced");
                else console.error(`    ERROR advance_cycle: ${msg}`);
            }
            return;
        }

        default:
            console.log(`  ${tag} — no keeper action for this state`);
    }
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

async function sweep(): Promise<number> {
    const groups = await discoverGroups();
    const tracked = loadState();
    console.log(
        `\n[sweep ${new Date().toISOString()}] ${groups.length} group(s), network=${NETWORK}, ` +
        `keeper=${keeperAddress.slice(0, 8)}…${DRY_RUN ? " [DRY-RUN]" : ""}`
    );
    for (const g of groups) {
        try {
            await processGroup(g, tracked);
        } catch (e) {
            console.error(`  ERROR processing ${g}: ${e instanceof Error ? e.message : e}`);
        }
        saveState(tracked);
    }
    saveState(tracked);
    return groups.length;
}

/** Turn raw SDK/axios failures into actionable one-liners. */
function describeError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused")) {
        return (
            `cannot reach RPC at ${RPC_URL} (${msg}).\n` +
            `  → check internet/VPN/firewall, or the network is wrong in .env.local.\n` +
            `  → for your TESTNET groups set NEXT_PUBLIC_NETWORK=TESTNET and\n` +
            `    NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org (real env vars override .env.local).`
        );
    }
    return msg;
}

/** Probe a contract id for liveness. A missing/uninstalled contract makes any
 *  simulation fail with a "missing contract/data" error; a live one does not. */
async function contractAlive(contractId: string): Promise<boolean> {
    try {
        await readCall(contractId, "get_group_info", []);
        return true; // clean read ⇒ definitely deployed
    } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
        const absent =
            msg.includes("missingcontract") ||
            msg.includes("missingcontractdata") ||
            msg.includes("contract data could not be found") ||
            msg.includes("not found") ||
            msg.includes("does not exist") ||
            msg.includes("no contract");
        return !absent; // any other error ⇒ contract exists, the call just isn't valid here
    }
}

/** `--check`: read-only health snapshot — contract liveness + every group state. */
async function checkAll(): Promise<void> {
    console.log("\n[check] contract liveness");
    const named: Array<[string, string | undefined]> = [
        ["factory", FACTORY_ID],
    ];
    for (const [label, id] of named) {
        if (!id) {
            console.log(`  ${label.padEnd(9)}: (unset)`);
            continue;
        }
        const ok = await contractAlive(id);
        console.log(`  ${label.padEnd(9)}: ${ok ? "ALIVE " : "MISSING"}  ${id}`);
    }

    const groups = await discoverGroups();
    console.log(`\n[check] ${groups.length} group(s)`);
    for (const groupId of groups) {
        try {
            const info = decodeGroupInfo(await readCall(groupId, "get_group_info"));
            const members = vecLen(await readCall(groupId, "get_members"));
            const usdc = Number(info.contributionAmount) / 1e7;
            console.log(
                `  ${groupId}\n` +
                `     state=${info.state} cycle=${info.currentCycle}/${info.totalCycles}` +
                ` members=${members}/${info.numMembers} contribution=${usdc} USDC` +
                ` admin=${info.admin}`
            );
        } catch (e) {
            console.log(`  ${groupId} — unreadable (${e instanceof Error ? e.message : e})`);
        }
    }
}

function printBanner(): void {
    const groupsEnv = (process.env.GROUPS || "").trim();
    console.log("ChainChit Phase Transition Keeper");
    console.log(`  network : ${NETWORK}${IS_TESTNET ? " (testnet)" : " (mainnet)"}`);
    console.log(`  rpc     : ${RPC_URL}`);
    console.log(`  keeper  : ${keeperAddress}${DRY_RUN ? "  [DRY-RUN — no txs submitted]" : ""}`);
    console.log(`  source  : ${groupsEnv ? `GROUPS override (${groupsEnv.split(",").length})` : `factory ${FACTORY_ID ?? "(unset!)"}`}`);
    console.log(
        `  windows : join ${JOIN_GRACE_MS / MIN}m · collect ${COLLECTION_WINDOW_MS / HOUR}h · ` +
        `bid ${BIDDING_WINDOW_MS / HOUR}h · payout ${PAYOUT_COOLDOWN_MS / MIN}m`
    );
}

async function main(): Promise<void> {
    printBanner();
    if (CHECK_ONLY) {
        await checkAll();
        return;
    }
    if (RUN_ONCE) {
        await sweep();
        return;
    }
    console.log(`\nkeeper daemon — sweeping every ${INTERVAL_SEC}s (Ctrl-C to stop)`);
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            await sweep();
        } catch (e) {
            console.error(`sweep failed: ${describeError(e)}`);
        }
        await sleep(INTERVAL_SEC * 1000);
    }
}

main().catch((e) => {
    console.error(`\n${describeError(e)}`);
    process.exit(1);
});
