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

**Total: 53 wallets**, ~400+ on-chain transactions this level.

## Group Contracts

| Group | Contract | Members | Contribution | Cycles | State |
|-------|----------|---------|--------------|--------|-------|
| A | [`CC2BGN75…V2W5GER`](https://stellar.expert/explorer/testnet/contract/CC2BGN75IGEWLOCRB3NLZO5HBHEH3NGBE6QNUONOVMGFMTEIPV2W5GER) | 10 | 5 USDC | 3 | Completed |
| B | [`CBWO3KSG…UONGQILA`](https://stellar.expert/explorer/testnet/contract/CBWO3KSGJM7TXTKONLDELGGOPQ42XZZZBXW2LTOFK6YSYB4KUONGQILA) | 3 | 2.5 USDC | 6 | Completed |
| C | [`CDNY2GLH…TZQSBMY`](https://stellar.expert/explorer/testnet/contract/CDNY2GLH4KVN2U3HFWR7KL3QLPLKGSZHPODLEFFUFBXFYH46PTZQSBMY) | 20 | 1.5 USDC | 2 | **Completed** |
| D | [`CDHPHEBP…SAUHXMU`](https://stellar.expert/explorer/testnet/contract/CDHPHEBPIR4ZKJFGVCZNRU6HQWRS45V72FXAPLPRDLK3K7BLESAUHXMU) | 20 | 1.5 USDC | 2 | **Completed** |

Cycle winners are verifiable on-chain: call `get_cycle_state(cycle)` on any
group contract, or check the payout transfers on Stellar Expert.

## Funding Log

Blue Belt cohort funded by the organizer wallet (`GBGNU4UD…TMAN`) — one
3-USDC top-up per member covering both contribution cycles. Per-member tx
hashes in [docs/users_testnet.csv](users_testnet.csv).

## Monthly Snapshot (2026-08)

| Metric | Value |
|--------|-------|
| New users onboarded | 40 |
| Total users | 53 |
| Transactions this month (provisioning runs) | ~400+ |
| Groups created | 2 (C, D) |
| Contributions paid | 80 (40 members × 2 cycles) |
| Payouts processed | 4 (2 groups × 2 cycles) |
