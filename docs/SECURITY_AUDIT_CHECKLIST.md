# Security Audit Checklist

Pre-deployment checklist for ChainChit smart contracts and frontend.

---

## Smart Contract Security

### Access Control

- [ ] All mutating functions call `require_auth()` on the `caller`/`admin` parameter
- [ ] Admin-only functions check `caller == admin` before proceeding
- [ ] Reputation `record_*` functions restricted to authorized group contracts only
- [ ] Dispute `raise_dispute` restricted to authorized group contracts only
- [ ] No unauthorized state changes possible through view functions

### Reentrancy

- [ ] Cross-contract calls flow in a single direction only (ChitGroup → Reputation/Identity/Dispute, Identity → Reputation, Dispute → Reputation)
- [ ] No contract calls back into a caller contract
- [ ] State changes happen before cross-contract calls where applicable
- [ ] No callback patterns or receiver hooks used

### Integer Safety

- [ ] All arithmetic uses checked or saturating operations (`saturating_add`, no plain `+` on user-controlled values)
- [ ] Amount types are `u64` (sufficient for USDC with 7 decimals)
- [ ] No integer overflow/underflow possible through any input path
- [ ] Division-by-zero guarded (e.g., `get_on_time_ratio` returns 0 for zero payments)

### Commit-Reveal Integrity

- [ ] Commitment verified as `SHA-256(amount_le_64 || nonce_le_64)` before accepting reveal
- [ ] `already_committed` flag prevents double-commit
- [ ] `already_revealed` flag prevents double-reveal
- [ ] Nonce space is 64-bit — brute-force infeasible
- [ ] Bid amount bounded by contribution context (sanity check on contract level)

### State Machine Integrity

- [ ] All state transitions explicitly check current state (e.g., `NotForming` error if wrong state)
- [ ] No way to skip states (e.g., can't go Forming → Bidding without Collecting)
- [ ] Pause blocks all state transitions except `unpause`
- [ ] Unpause returns to the state that was active before pause
- [ ] Completed state is terminal — no further mutations

### Token Safety

- [ ] Token transfers use SAC interface via `env.invoke_contract` (no raw balance manipulation)
- [ ] Payout transfers only happen in `Payout` state via `execute_payout`
- [ ] Contribution transfers only happen in `Collecting` state via `pay_contribution`
- [ ] No token balance can be locked in contract after `Completed` state (all cycles paid out)

### Storage

- [ ] Instance storage used for config (admin, contract addresses, thresholds) — durable and low-cost
- [ ] Persistent storage used for per-member/per-cycle data — auto-expiry managed by runtime
- [ ] No unbounded storage growth: members capped at `num_members`, cycles at `total_cycles`
- [ ] `Vec` iterations bounded by known sizes (num_members, total_cycles, arbitrator count)

---

## Identity & Attestation Security

- [ ] Self-attestation explicitly rejected (`SelfAttestation` error)
- [ ] Duplicate attestation explicitly rejected (`DuplicateAttestation` error)
- [ ] Attestation weight derived from **current** reputation score at vouch time
- [ ] Zero-reputation accounts carry zero attestation weight (Sybil resistance)
- [ ] Minimum threshold configurable by admin only

---

## Dispute Security

- [ ] Minimum 3 arbitrators enforced at initialization
- [ ] `required_votes` must be ≥ 2 and ≤ number of arbitrators
- [ ] Double-voting prevented via `AlreadyVoted` error
- [ ] Auto-resolution when threshold met — no admin bottleneck for clear outcomes
- [ ] Dispute outcomes feed back to Reputation contract (accountability loop)
- [ ] Authorized callers only for `raise_dispute` (prevents spam disputes)

---

## Frontend Security

- [ ] No private keys stored client-side — all signing via wallet extension
- [ ] All contract interactions go through `simulateTransaction` before signing (fee disclosure)
- [ ] No `any` types in TypeScript (strict mode)
- [ ] Transaction simulation errors displayed to user before signing
- [ ] SEP-24 flows opened in separate window (wallet-hosted KYC, no PII on our frontend)
- [ ] No hardcoded contract IDs — all from environment variables
- [ ] Input validation on all forms (min amounts, member counts, etc.)

---

## Operational Security

- [ ] Admin key uses hardware wallet or multi-sig in production
- [ ] Emergency pause tested and functional
- [ ] Contract addresses configurable post-deployment via `update_contracts`
- [ ] RPC URL configurable (not hardcoded to single provider)
- [ ] `.env.local` never committed to git (in `.gitignore`)
- [ ] No test keys in production configuration

---

## Pre-Deployment Verification

- [ ] `cargo test` passes all contract tests
- [ ] `cargo build --target wasm32-unknown-unknown --release` succeeds
- [ ] `cd frontend && npm run build` succeeds with zero errors
- [ ] All contracts deployed to testnet and initialized
- [ ] End-to-end flow tested: create group → join → pay → bid → reveal → payout
- [ ] Emergency pause and unpause tested on testnet
- [ ] Dispute flow tested: raise → vote → resolution → reputation update
