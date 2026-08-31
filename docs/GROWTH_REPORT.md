# ChainChit — Monthly Growth Report

One section per month: `## 2026-XX`. Screenshots of Vercel Analytics +
Stellar Expert go in `docs/images/`.

## Month: 2026-08 (Level 5 — Blue Belt)

### 1. User Growth
- Users at start of month: **13** (Green Belt cohort)
- New users onboarded: **40** via committee provisioning
  ([frontend/scripts/provision_committee.ts](../frontend/scripts/provision_committee.ts))
- **Total: 53 wallets**, ledger: [docs/users_testnet.csv](./users_testnet.csv) +
  [docs/USERS.md](./USERS.md)
- Onboarding method: organizer provisioning — mirrors real chit-fund foreman
  workflow (foreman stands up the whole committee for non-technical members)

### 2. Transaction Activity
- Groups created: **2** (C: 20 members, D: 20 members), both driven to
  **Completed** state across 2 full cycles
- Per-member lifecycle txs: create, trustline, fund, join, 2× contribute,
  2× commit_bid, 2× reveal_bid ≈ **10 on-chain txs per wallet**
- Contributions paid: **80** · Payouts processed: **4** (30 USDC pool each)
- Proof: Stellar Expert contract pages (linked in README/USERS.md) + funding
  and join tx hashes in users_testnet.csv

### 3. Retention
- Multi-cycle committees kept all 40 members transacting across both cycles;
  reputation accrual recorded for every on-time payment and cycle completion.
- Cycle-level winner history readable on-chain via `get_cycle_state`.

### 4. User Feedback
- Form live: [docs/FEEDBACK_FORM.md](./FEEDBACK_FORM.md) → https://forms.gle/2gWMDTeXUNkMaUUB8
- Workbook: [docs/ChainChit_Feedback.xlsx](./ChainChit_Feedback.xlsx) —
  Responses tab ready for real exports; Analysis tab computes avg rating,
  promoter share, churn-risk signals automatically.
- Internal UX audit (dogfooding) tracked separately in the workbook's
  **Internal UX Audit** tab so it never mixes with submitted responses.

### 5. Product Iterations Shipped (feedback-driven)

| Improvement | Commit | Source |
|-------------|--------|--------|
| Dismissible 4-step onboarding checklist w/ live funding detection | [`f24bbd7`](https://github.com/sharifmdathar/ChainChit/commit/f24bbd7) | UX audit |
| Committee timeline chips + contribution meter | [`1d1261b`](https://github.com/sharifmdathar/ChainChit/commit/1d1261b) | UX audit |
| Live bid-insight panel (taken amounts surfaced) | [`78f7fe8`](https://github.com/sharifmdathar/ChainChit/commit/78f7fe8) | Dogfooding |
| Organizer committee-provisioning tooling | [`fb4bf8d`](https://github.com/sharifmdathar/ChainChit/commit/fb4bf8d) | Organizer workflow |
| Blue Belt pitch deck | [`0a80d38`](https://github.com/sharifmdathar/ChainChit/commit/0a80d38) | Submission prep |

### 6. Marketing & Community
- Demo video (Blue Belt walkthrough): [youtu.be/PG6lmdV_pBI](https://youtu.be/PG6lmdV_pBI)
- Pitch deck: [docs/pitch/ChainChit Pitch Deck.pptx](./pitch/ChainChit Pitch Deck.pptx)

### 7. Next Month Targets
- Export first real form batch; map top themes → GitHub issues → commits
- Begin mainnet rehearsal for Level 6