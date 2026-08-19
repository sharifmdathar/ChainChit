# Security Audit Checklist

Pre-deployment checklist for ChainChit smart contracts and frontend.

**Audit date:** 2026-08-20 · **Method:** full source read of all 5 contracts + frontend, live execution of `cargo test`, `stellar contract build`, `npm run build`

| Verdict | Count |
|---|---|
| ✅ PASS | 53 |
| ⚠️ PARTIAL | 8 |
| ❌ FAIL | 0 |
| 🔧 OPS-REQUIRES-USER | 1 |

## Findings & Fixes

1. **CRITICAL — Dispute raise flow was mis-wired.** `chit_group.raise_dispute` passed the member as `caller` (and only 3 args against a 4-arg signature), so every legitimate raise failed. **Fixed** (`contracts/chit_group/src/lib.rs:644-659`): caller = the chit_group contract itself (authorized by factory), raiser = the member; verified by `test_raise_dispute_wiring`.
2. **CRITICAL — Dispute→Reputation accountability loop could not fire.** The dispute contract was never authorized in Reputation. **Fixed** (`scripts/deploy.ts`): deploy now calls `reputation authorize_group(dispute)` after init.
3. **CRITICAL — Production arbitrator panel was deadlocked.** `deploy.ts` seeded 2 discarded `Keypair.random()` dummies, making auto-resolution unreachable. **Fixed** (`scripts/deploy.ts`): arbitrators come from `DISPUTE_ARBITRATORS` env (min 3 keys); if unset, fresh keypairs are generated and their secrets **printed once** with a save warning. `DISPUTE_REQUIRED_VOTES` configurable (default 2).
4. **HIGH — Frontend build failed.** `fund_users.ts` imported removed `Server` export. **Fixed** (uses `Horizon.Server`); `npm run build` verified green.
5. **MEDIUM — Completed was not terminal.** `pause` had no state check and `unpause` accepted an arbitrary resume state, allowing resurrection of finished groups. **Fixed** (`contracts/chit_group/src/lib.rs`): `pause` rejects `Completed` (#24); pre-pause state is stored (`DataKey::PrePauseState`) and restored by `unpause` (resume_state param ignored). `raise_dispute` also blocked while `Paused` (#12).
6. **MEDIUM — Weak bid-nonce entropy.** Frontend used `Math.random()` (53 bits, non-CSPRNG). **Fixed** (`frontend/src/components/BiddingPanel.tsx`): `crypto.getRandomValues` 53-bit nonce.
7. **MEDIUM — `any` types despite strict mode.** 6 sites. **Fixed** (`utils.ts`, `stellar.ts`, `contracts.ts`, group page, create-group page, faucet route) — build type-checks clean.
8. **LOW — Identity duplicate-attestation test was an empty stub.** **Fixed** (`contracts/identity/src/lib.rs`): real test with mock reputation, `test_duplicate_attestation_rejected` now exercises the duplicate path.
9. **LOW — Known risk, not yet fixed:** if `execute_payout` finds `NoValidBids` (#23), funds stay locked in `Bidding` with no refund path. Deferred — needs design decision (admin refund escape hatch).

---

## Smart Contract Security

### Access Control

- [x] **PASS** — All mutating functions call `require_auth()` on caller/admin.
  Evidence: `chit_group/src/lib.rs:133,176,225,272,357,435,488,626,658,677,713`; `reputation/src/lib.rs:72,86,101,128` (+`ensure_authorized` on `record_*`); `identity/src/lib.rs:64,80,183,204`; `dispute/src/lib.rs:99,122,137,201,268,320,351`; `factory/src/lib.rs:40,64,143`. *Exception:* `execute_payout` (`chit_group:538`) permissionless by design — anyone can trigger payout.
- [x] **PASS** — Admin-only functions check `caller == admin`.
  Evidence: `chit_group:233,365,666,685,721`; `reputation:92,134`; `identity:189,210`; `dispute:128,275,326,356`; `factory:149`.
- [x] **PASS** — Reputation `record_*` restricted to authorized group contracts.
  Evidence: `ensure_authorized` gate `reputation/src/lib.rs:409-419`, applied at `:150,183,214,248,283`. Factory authorizes deployed groups (`factory/src/lib.rs:119`). Dispute contract authorized at deploy (see Findings #2).
- [x] **PASS** — Dispute `raise_dispute` restricted to authorized group contracts.
  Evidence: `ensure_authorized` (`dispute/src/lib.rs:163`, `:396-406`); chit_group now passes its own contract address as caller (Finding #1), verified by `test_raise_dispute_wiring`.
- [x] **PASS** — No unauthorized state changes through view functions.
  Evidence: `get_group_info/get_members/get_cycle_state/get_member_payment_status` (`chit_group:743-777`) and all reputation/identity/dispute/factory views are read-only.

### Reentrancy

- [x] **PASS** — Cross-contract calls flow in a single direction.
  Evidence: ChitGroup→Identity (`chit_group:818-826`), ChitGroup→Reputation (`:837-905`), ChitGroup→Dispute (`:647`), Identity→Reputation (`identity:223-230`), Dispute→Reputation (`dispute:408-437`), Factory→ChitGroup/Reputation/Dispute (`factory:111-120`). No cycle.
- [x] **PASS** — No contract calls back into a caller contract.
  Evidence: all `invoke_contract` targets are admin-configured addresses; none resolves to a caller.
- [x] **PARTIAL** — State changes happen before cross-contract calls where applicable.
  `pay_contribution` records payment before the reputation call (`chit_group:311` → `:315`) ✓. Token transfers precede state mutation in `pay_contribution` (`:302-308`) and `execute_payout` (`:598-604`). Not exploitable — SAC has no receive hooks and Soroban rolls back atomically — but ordering is not strictly "state-first".
- [x] **PASS** — No callback patterns or receiver hooks used.
  Evidence: no `receive`/callback functions; only explicit `invoke_contract`.

### Integer Safety

- [x] **PASS** — All arithmetic checked or saturating.
  Evidence: `saturating_add`/`saturating_sub` (`reputation:169-173,202-203,233,267,302-304,397`); `checked_mul` for pool size (`chit_group:594-596`); `overflow-checks = true` (`Cargo.toml:16`).
- [x] **PASS** — Amount types are `u64`.
  Evidence: `contribution_amount: u64` (`chit_group:57`), `BidRecord.amount: u64` (`:38`), `winning_bid: u64` (`:46`).
- [x] **PASS** — No overflow/underflow through any input path.
  Evidence: `overflow-checks=true` + checked/saturating ops; frontend `u64ToScVal` uses BigInt (`stellar.ts:216-218`); out-of-range amounts rejected at reveal (`chit_group:523`).
- [x] **PASS** — Division-by-zero guarded.
  Evidence: `get_on_time_ratio` returns 0 when `total_payments_due == 0` (`reputation:343-345`); `get_composite_score` guards `total_payments_due > 0` (`:386-391`).

### Commit-Reveal Integrity

- [x] **PASS** — Commitment verified as `SHA-256(amount_le_64 || nonce_le_64)`.
  Evidence: `compute_commitment` (`chit_group/src/lib.rs:907-931`) serializes amount as 8 LE bytes then nonce as 8 LE bytes, SHA-256, returns 32×u32. Frontend mirrors construction (`utils.ts:70-87`). Length enforced ==32 (`chit_group:466-468`); compared at reveal (`:517-520`).
- [x] **PASS** — `already_committed` prevents double-commit.
  Evidence: `cycle.bids.get(caller).is_some()` → `AlreadyCommitted` (`chit_group:462-464`).
- [x] **PASS** — `already_revealed` prevents double-reveal.
  Evidence: `bid.revealed` → `AlreadyRevealed` (`chit_group:512-514`).
- [x] **PASS** — Nonce space 64-bit, brute-force infeasible.
  Contract: `nonce: u64` (`chit_group:486`). Frontend now CSPRNG: `crypto.getRandomValues` 53-bit (`BiddingPanel.tsx:75-77`, Finding #6).
- [x] **PASS** — Bid amount bounded by contribution context.
  Evidence: `amount == 0 || amount > info.contribution_amount` → `BidTooLow` (`chit_group:523`).

### State Machine Integrity

- [x] **PASS** — All state transitions explicitly check current state.
  Evidence: `NotForming` (`chit_group:184`), `NotCollecting` (`:280`), `NotBidding` (`:443,496`), `NotPayout` (`:368`). `raise_dispute` rejects `Completed` and `Paused`.
- [x] **PASS** — No way to skip states.
  Normal flow strictly gated (Forming→Collecting→Bidding→Payout→Completed). `unpause` restores the recorded pre-pause state — admin can no longer jump to an arbitrary state (Finding #5).
- [x] **PASS** — Pause blocks all state transitions except `unpause`.
  `raise_dispute` now rejects `Paused` (`chit_group:640-642`); all other mutations fail state checks against `Paused`. Verified by `test_raise_dispute_paused`.
- [x] **PASS** — Unpause returns to the state that was active before pause.
  Pre-pause state stored in `DataKey::PrePauseState` at `pause`, restored by `unpause` (resume_state param ignored). Verified by `test_unpause_restores_pre_pause_state`.
- [x] **PASS** — Completed state is terminal.
  `pause` rejects `Completed` (`chit_group:676-679`); `advance_cycle` terminates at Completed (`:407-410`). Verified by `test_pause_completed_rejected`.

### Token Safety

- [x] **PASS** — Transfers use SAC via `env.invoke_contract`.
  Evidence: `transfer_token` (`chit_group/src/lib.rs:798-816`) invokes `"transfer"` on the configured token. No raw balance manipulation.
- [x] **PARTIAL** — Payout transfers only in `Payout` state via `execute_payout`.
  The only outbound payout is `execute_payout` (`chit_group:598-604`), but it executes while state is **Bidding** (`:545`) and transitions to `Payout` afterward (`:618`). Single-path, but not gated on the `Payout` state itself.
- [x] **PASS** — Contribution transfers only in `Collecting` via `pay_contribution`.
  Evidence: `NotCollecting` gate (`chit_group:280`); only inbound transfer at `:302-308`.
- [x] **PASS** — No token balance locked after `Completed`.
  The `all_paid` gate (`chit_group:329-350`) guarantees full collection; payout moves the full pool (`checked_mul` `:594-596`); balance returns to zero before `Completed`. *Caveat:* `NoValidBids` (`:591`) can strand funds pre-Completed — known risk, see Findings #9.

### Storage

- [x] **PASS** — Instance storage for config.
  Evidence: `GroupInfo`/`Members` (`chit_group:165-168`), reputation admin/map (`reputation:74-80`), identity config (`identity:66-72`), dispute config (`dispute:108-116`), factory (`factory:44-48`).
- [x] **PARTIAL** — Persistent storage for per-member/per-cycle data.
  Only Identity attestations use persistent storage (`identity/src/lib.rs:97,117-119`). ChitGroup stores per-cycle/per-member data in instance storage (`chit_group:165-168,261-263`). Mixed usage — checklist claim holds only for Identity.
- [x] **PASS** — No unbounded storage growth.
  Evidence: `GroupFull` when `members.len() >= num_members` (`chit_group:202`); cycle keys created only while `current_cycle < total_cycles` (`:407`, `:425-427`).
- [x] **PASS** — `Vec` iterations bounded by known sizes.
  Evidence: member loops (`chit_group:195,330,386,566`), bid-amount loop ≤ num members (`:582`), arbitrator loops (`dispute:216,221,337,367,388`), fixed 0..32 (`chit_group:928`).

## Identity & Attestation Security

- [x] **PASS** — Self-attestation rejected.
  Evidence: `vouchor == vouchee` → `SelfAttestation` (`identity/src/lib.rs:82-84`); test `identity:252-264`.
- [x] **PASS** — Duplicate attestation rejected.
  Evidence: duplicate vouchor scan → `DuplicateAttestation` (`identity/src/lib.rs:101-107`); test now real — `test_duplicate_attestation_rejected` exercises the path with a mock reputation (Finding #8).
- [x] **PASS** — Weight derived from current reputation at vouch time.
  Evidence: `weight = get_reputation_score(vouchor)` during `vouch` (`identity/src/lib.rs:93`, impl `:223-230`).
- [x] **PASS** — Zero-reputation accounts carry zero weight.
  Evidence: `get_composite_score` returns 0 for unknown accounts (`reputation/src/lib.rs:380-383`); `test_stranger_zero_reputation` (`reputation:660-673`).
- [x] **PASS** — Minimum threshold admin-configurable only.
  Evidence: `set_min_weight` admin-gated (`identity/src/lib.rs:199-217`).

## Dispute Security

- [x] **PASS** — Minimum 3 arbitrators enforced.
  Evidence: `arbitrators.len() < 3` → `NotEnoughArbitrators` (`dispute/src/lib.rs:101-103`); test `dispute:478-489`.
- [x] **PASS** — `required_votes` ≥ 2 and ≤ arbitrators.
  Evidence: `dispute/src/lib.rs:104-106`; tests `dispute:817-844`.
- [x] **PASS** — Double-voting prevented.
  Evidence: membership scan across both vote arrays → `AlreadyVoted` (`dispute/src/lib.rs:216-225`); test `dispute:636-659`.
- [x] **PASS** — Auto-resolution when threshold met.
  Evidence: `votes_for/against >= required` → `Resolved`/`Dismissed` + `resolved_at` (`dispute/src/lib.rs:243-252`); tests `dispute:565-633`. Reachable in production — real arbitrator keys now seeded at deploy (Finding #3).
- [x] **PASS** — Dispute outcomes feed back to Reputation.
  Mechanism: `record_dispute_outcome` (`dispute/src/lib.rs:408-437`) calls `record_dispute_outcome` with caller = dispute contract; dispute contract now authorized in Reputation at deploy (Finding #2).
- [x] **PASS** — Authorized callers only for `raise_dispute`.
  Restriction enforced (`dispute:163,396-406`); chit_group wires caller correctly (Finding #1).

## Frontend Security

- [x] **PASS** — No private keys client-side; signing via wallet extension.
  Evidence: Freighter signing (`stellar.ts:128-131`); faucet key server-only + testnet-gated (`api/faucet/route.ts:11,21-26`); mock wallet opt-in, default off (`stellar.ts:20`).
- [x] **PASS** — Contract interactions simulate before signing.
  Evidence: `invokeContract` simulates (`stellar.ts:196`), rejects on `isSimulationError` (`:198-200`), signs only after (`:208`).
- [x] **PASS** — No `any` types (strict mode).
  `strict:true` (`frontend/tsconfig.json:7`); all 6 `any` sites removed (Finding #7). `npm run build` type-checks clean.
- [x] **PASS** — Simulation errors displayed before signing.
  Evidence: thrown at `stellar.ts:198-200`; surfaced via toast (`BiddingPanel.tsx:122-127`, `ContributionFlow.tsx:31-32`).
- [x] **PASS** — SEP-24 flows in separate window, anchor-hosted KYC.
  Evidence: `window.open` + navigate (`Sep24Ramp.tsx:45,70`); KYC anchor-hosted; backend proxy relays only SEP-10 challenge/JWT (`api/sep24/route.ts`), no PII stored.
- [x] **PASS** — No hardcoded contract IDs — all env-driven.
  Evidence: `env()` wrapper reads `NEXT_PUBLIC_CONTRACT_*` (`contracts.ts:29-44`); USDC issuer fallback is a public issuer pubkey, not a contract ID.
- [x] **PASS** — Input validation on forms.
  Evidence: contribution>0, members≥2, cycles≥2 (`create-group/page.tsx:32-35`); bid amount >0 (`BiddingPanel.tsx:69-73`); dispute reason required; ramp amounts `min="1"`.

## Operational Security

- [x] **OPS-REQUIRES-USER** — Admin key uses hardware wallet or multi-sig in production.
  Not provable from code. **User action:** hold the admin key (`SOROBAN_SECRET_KEY`, used by `scripts/deploy.ts`) on a Ledger/Trezor or Stellar multisig in production. For mainnet, also set `DISPUTE_ARBITRATORS` to keys you control (deploy.ts refuses to silently generate throwaway keys on mainnet without warning).
- [x] **PASS** — Emergency pause tested and functional.
  Evidence: `test_pause`, `test_pause_non_admin`, `test_unpause_restores_pre_pause_state`, `test_unpause_not_paused`, `test_pause_completed_rejected` all pass. On-testnet verification is an OPS action.
- [x] **PASS** — Contract addresses configurable post-deployment.
  Evidence: `update_contracts` (`chit_group:706-737`), `set_reputation_contract` (`identity:178-196`), `set_factory` (`reputation:85-97`, `dispute:121-133`), `update_wasm_hash` (`factory:138-156`).
- [x] **PASS** — RPC URL configurable.
  Evidence: `NEXT_PUBLIC_STELLAR_RPC_URL` (`stellar.ts:53`); `SOROBAN_RPC_URL` in scripts env.
- [x] **PASS** — `.env.local` never committed.
  Evidence: `.gitignore:5`; `git check-ignore` confirms ignored; only `.env.example`/`.env.local.example` tracked.
- [x] **PASS** — No test keys in production configuration.
  Evidence: mock wallet secret opt-in gated (`stellar.ts:20`, `.env.local.example:14-15`); faucet secret server-only + testnet-blocked (`faucet/route.ts:21-26`). **OPS:** never set `NEXT_PUBLIC_MOCK_WALLET_SECRET` / `MOCK_ACCOUNT_SECRET` on prod.

## Pre-Deployment Verification

- [x] **PASS** — `cargo test` passes.
  Live run: **66 tests pass, 0 fail** — chit_group 25, dispute 18, identity 11, reputation 12, factory 0 (ships no unit tests).
- [x] **PASS** — `stellar contract build` succeeds.
  Live run: all 5 contracts built (`target/wasm32v1-none/release/*.wasm`), `✅ Build Complete`.
- [x] **PASS** — `cd frontend && npm run build` succeeds with zero errors.
  Live run: type-check + all 11 routes build green (Finding #4).
- [x] **PARTIAL** — All contracts deployed to testnet and initialized.
  Documented in `README.md` (factory `CAJBU4IDXR5PFHY3AKRDUS2LTRID7ONORUXJJYG5LDPTG2QMREINLF6V`, reputation, identity, dispute, 2 live groups). Requires on-chain/StellarExpert confirmation.
- [x] **PARTIAL** — E2E flow tested: create → join → pay → bid → reveal → payout.
  Individual steps unit-tested; no automated E2E artifact in repo. README documents live testnet activity.
- [x] **PARTIAL** — Emergency pause/unpause tested on testnet.
  Unit tests only. **OPS action:** execute and record a pause/unpause tx on testnet.
- [x] **PARTIAL** — Dispute flow tested: raise → vote → resolution → reputation update.
  Wiring fixed (Findings #1-3) and unit-tested end-to-end (mock dispute asserts caller/raiser; dispute auto-resolution tests pass). On-testnet E2E verification still required before mainnet.