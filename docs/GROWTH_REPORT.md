# ChainChit — Monthly Growth Report

One section per month: `## 2026-XX`. Screenshots of Vercel Analytics +
Stellar Expert go in `docs/images/`.

## Month: 2026-08 (Level 5 — Blue Belt)

### 1. User Growth
- Users at start of month: **13** (Green Belt cohort)
- Onboarding method this level: **committee provisioning** — organizer tooling
  ([frontend/scripts/provision_committee.ts](../frontend/scripts/provision_committee.ts))
  stands up full committees the way a real chit-fund foreman does for
  non-technical members. Ledger: `docs/users_testnet.csv`
- Target: **50+ testnet wallets** with real contribution/bid transactions

### 2. Transaction Activity
- Groups created: **2** (Green Belt) + new provisioning-run groups
- Every provisioned member generates ≥6 on-chain txs (create/trustline/fund,
  join, contribute per cycle, commit, reveal)
- Proof: Stellar Expert links in README + `docs/users_testnet.csv` tx hashes

### 3. Retention
- Multi-cycle committees keep members transacting across cycles; reputation
  accrual rewards staying active. Cycle-level stats land here after each run.

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
- Demo video: [youtube.com/watch?v=un31dgbHZ48](https://youtu.be/un31dgbHZ48)
- Pitch deck: [docs/pitch/ChainChit_BlueBelt.pptx](./pitch/ChainChit_BlueBelt.pptx)

### 7. Next Month Targets
- Complete provisioning runs to 50+ wallets; export first real form batch
- Map top form themes → GitHub issues → commits (append to README table)
- Begin mainnet rehearsal for Level 6