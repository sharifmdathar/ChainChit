# ChainChit — Testnet User Ledger

Ledger of onboarded testnet users with on-chain proof. Full per-wallet detail
(wallet address, group contract, funding tx hash, join date, status) lives in
the machine-readable ledger: [docs/users_testnet.csv](users_testnet.csv).

**Status**: `onboarded` = funded + joined a group, `active` = ≥1 contribution
or bid transaction in current month, `churned` = no activity 30+ days.

## Summary

| Cohort | Users | Groups | Activity |
|--------|-------|--------|----------|
| Green Belt (2026-07) | 13 | A (10), B (3) | funded via Friendbot, joined groups, contributed |
| Blue Belt (2026-08) | 40 | C (20), D (20) | full lifecycle ×2 cycles: join → contribute → commit-reveal bids → payout |
| Black Belt (2026-09) | 56 | F (20), G (20), H (16) | join-only onboarding sweep — 56 wallets friendbot-funded + `join_group` on the live factory; Phase Transition Keeper installed as a systemd timer |

**Total: 109 wallets**, ~460+ on-chain transactions to date.

## Group Contracts

| Group | Contract | Members | Contribution | Cycles | State |
|-------|----------|---------|--------------|--------|-------|
| A | [`CC2BGN75…V2W5GER`](https://stellar.expert/explorer/testnet/contract/CC2BGN75IGEWLOCRB3NLZO5HBHEH3NGBE6QNUONOVMGFMTEIPV2W5GER) | 10 | 5 USDC | 3 | Completed |
| B | [`CBWO3KSG…UONGQILA`](https://stellar.expert/explorer/testnet/contract/CBWO3KSGJM7TXTKONLDELGGOPQ42XZZZBXW2LTOFK6YSYB4KUONGQILA) | 3 | 2.5 USDC | 6 | Completed |
| C | [`CDNY2GLH…TZQSBMY`](https://stellar.expert/explorer/testnet/contract/CDNY2GLH4KVN2U3HFWR7KL3QLPLKGSZHPODLEFFUFBXFYH46PTZQSBMY) | 20 | 1.5 USDC | 2 | **Completed** (keeper-advanced) |
| D | [`CDHPHEBP…SAUHXMU`](https://stellar.expert/explorer/testnet/contract/CDHPHEBPIR4ZKJFGVCZNRU6HQWRS45V72FXAPLPRDLK3K7BLESAUHXMU) | 20 | 1.5 USDC | 2 | **Completed** (keeper-advanced) |
| E | [`CB34SC3G…ELS6KR3C`](https://stellar.expert/explorer/testnet/contract/CB34SC3GBPZBLPLW3HRJ3XDP3IUDG33APV5GU7YAW7E3X45IELS6KR3C) | 2 | 1 USDC | 2 | keeper smoke-test — advanced c1→c2, now Collecting |
| F | [`CA3P3M22…B76JGNW`](https://stellar.expert/explorer/testnet/contract/CA3P3M22PPHVFY2UKCPOEUCNTIGIPLFTF3FO7DN2PIPIT6W2NB76JGNW) | 20/20 | 2.5 USDC | 2 | Forming (full) — join-only |
| G | [`CDCMBOFS…QS2LN2E`](https://stellar.expert/explorer/testnet/contract/CDCMBOFSHQUL6DU5OIMTI73HMZE2C7E5FLC6ISTFJDYU5ENDZQS2LN2E) | 20/20 | 2.5 USDC | 2 | Forming (full) — join-only |
| H | [`CCVI2KUL…KEMFDYR`](https://stellar.expert/explorer/testnet/contract/CCVI2KULJ3JK2DUMVDV6TCO3TEARAQ3B3TOQ6K5ZBVRLBSF62KEMFDYR) | 16/16 | 2.5 USDC | 2 | Forming (full) — join-only |

### Keeper-advanced final cycles (2026-09-21)

The Phase Transition Keeper (`frontend/scripts/keeper.ts`) submitted the final
`advance_cycle` for the testnet cohorts after their payout dwell window:

| Group | Cycle | Result | Tx |
|-------|-------|--------|----|
| D `CDHPHEBP…` | 2 (final) | Payout → Completed | [`9ea31bd4…`](https://stellar.expert/explorer/testnet/tx/9ea31bd4b616bb1f460eea58cd1012eb1e7464bfae98cd02963ca090596d76b9) |
| C `CDNY2GLH…` | 2 (final) | Payout → Completed | [`9a1430e5…`](https://stellar.expert/explorer/testnet/tx/9a1430e528b522c1cb03016ed85f5d39f2577f1aaefbe77eac5fbc79c29f464f) |
| E `CB34SC3G…` | 1 → 2 | Payout → next cycle | [`a2e44af8…`](https://stellar.expert/explorer/testnet/tx/a2e44af8f04442577b6fa698a2536f60ae08811986a5f33cdb8f97015a4a13fa) |

Cycle winners are verifiable on-chain: call `get_cycle_state(cycle)` on any
group contract, or check the payout transfers on Stellar Expert.

## Contract Upgrade — Collection Deadline (2026-09-22)

`chit_group` was extended with an on-chain collection deadline and a
permissionless `begin_bidding_after_deadline()` — a cycle where a member never
pays no longer stalls forever. Companion changes: admin-tunable
`set_collection_window` (default 7 days) + `get_collection_deadline` view, a
payout pool re-based on the **actual paid count** (fixes a latent over-withdraw
once defaulters can reach Bidding), and a paid-only `commit_bid` gate so a
defaulter cannot win a pool it did not fund. Specs in
[docs/CONTRACT_API.md](CONTRACT_API.md); rationale in
[docs/SECURITY_AUDIT_CHECKLIST.md](SECURITY_AUDIT_CHECKLIST.md) Finding #10.

Surgically redeployed — only the `chit_group` wasm changed; every existing
contract id, group, and `frontend/.env.local` is untouched:

| Item | Value |
|------|-------|
| New `chit_group.wasm` hash | `dda14266e6996148d4e83244f764d3081c8cf1958e66c10b082af1e3f82fc1f9` |
| Wasm upload tx | [`0e883ecc…3fd791`](https://stellar.expert/explorer/testnet/tx/0e883ecc070ee298557306ea54a9650ca73931af066f2ad4e1b8418fbf3fd791) |
| Factory `update_wasm_hash` tx | [`5b7c3570…370bd1`](https://stellar.expert/explorer/testnet/tx/5b7c357009463f4da467f664942181776fb87f82a759554dce9d52478d370bd1) |
| Factory now pointing at new wasm | [`CAYOIBPQ…T5OXUBB`](https://stellar.expert/explorer/testnet/contract/CAYOIBPQO4QK6Q3YD4OYDMFRV4BLFZMQ3NVFUB522VHVC62ZPT5OXUBB) |

> Existing groups A–H were instantiated on the previous wasm and are immutable —
> they keep the old lifecycle (no collection deadline). Only groups created
> **after** this upgrade use the new code.

### Live Validation (2026-09-22)

The new path was driven end-to-end on testnet by
[`frontend/scripts/validate_deadline.ts`](../frontend/scripts/validate_deadline.ts)
(a reusable harness, mirroring `provision_committee.ts`). A fresh 2-seat group
was created through the upgraded factory with a 60 s window; one seat paid, the
other defaulted. Every assertion passed:

| Behaviour proven | Result |
|------------------|--------|
| `start_collection` arms a real on-chain deadline | `get_collection_deadline` = now + 60 s |
| A not-all-paid cycle no longer auto-advances | stayed `Collecting` (the old stall) |
| Defaulter cannot bid | `commit_bid` reverted `NotPaid` (#29) |
| Permissionless force-advance after deadline | `begin_bidding_after_deadline` → `Bidding`, defaulter → `Defaulted` |
| Pool re-based on **paid count**, not members | payout = `1 × contribution`; contract drained `0.10 → 0.00` USDC |

Validated group: [`CANT5OHC…K3ODIB3D`](https://stellar.expert/explorer/testnet/contract/CANT5OHCF3APTVDLN2S4MH3IBM3NZC5AVTCENDCGVJBYAB4LK3ODIB3D) —
key tx: `create_group`
[`4ce61b53…`](https://stellar.expert/explorer/testnet/tx/4ce61b536f2a5e7751ffaee99749108815fb6c39ad3d6c4334a8d64391913380),
`start_collection`
[`83e79ec0…`](https://stellar.expert/explorer/testnet/tx/83e79ec08bdf8358ff355621c5f99b82ce702b623d2211eac1949dc7a3c33270),
`begin_bidding_after_deadline`
[`dfc5ea9f…`](https://stellar.expert/explorer/testnet/tx/dfc5ea9f6e4c4ff6ee280054ed39e67f81fcf38e5a82bbd50548a7d224f3cb53),
`execute_payout`
[`ecca2fe3…`](https://stellar.expert/explorer/testnet/tx/ecca2fe3016095cb2610da3d32be8631d0ee155fc1a196923d7ec23eb1e6e86f).

> These validation groups (`CANT5OHC…`, plus two aborted runs `CBZNWRL7…`
> empty/Forming and `CDKGTN5J…` mid-Collecting holding 0.10 USDC) are throwaway
> test fixtures — add them to the keeper's `GROUPS_SKIP` so it doesn't churn
> their empty cycle 2.

## Funding Log

Blue Belt cohort funded by the organizer wallet (`GBGNU4UD…TMAN`) — one
3-USDC top-up per member covering both contribution cycles. Per-member tx
hashes in [docs/users_testnet.csv](users_testnet.csv).

## Monthly Snapshot (2026-09)

| Metric | Value |
|--------|-------|
| New users onboarded | 56 |
| Total users | 109 |
| Groups created (live factory) | 3 (F, G, H) |
| On-chain joins | 56 |
| Keeper automation | `advance_cycle` fired 3× (C/D final, E c1→c2); systemd timer installed |

_F/G/H are held at `Forming` (full): the 56-wallet cohort is a join-onboarding
sweep and its members hold no settlement USDC, so they are intentionally not
advanced into `Collecting` (the contract cannot force-advance a stalled,
under-funded collection). Funding these wallets is the next milestone._

## Monthly Snapshot (2026-08)

| Metric | Value |
|--------|-------|
| New users onboarded | 40 |
| Total users | 53 |
| Transactions this month (provisioning runs) | ~400+ |
| Groups created | 2 (C, D) |
| Contributions paid | 80 (40 members × 2 cycles) |
| Payouts processed | 4 (2 groups × 2 cycles) |
