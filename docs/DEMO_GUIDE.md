# ChainChit — Demo Guide & Walkthrough

Complete walkthrough covering all features, pages, and submission requirements for the Stellar Builder Challenge.

---

## Quick Links

| Resource | Link |
|----------|------|
| **Live App** | [chain-chit.vercel.app](https://chain-chit.vercel.app/) |
| **Pitch Deck** | [View on Canva](https://canva.link/s0ovylmrz1e4gnh) |
| **Demo Video** | *[YouTube link — paste after upload]* |
| **README** | [../README.md](../README.md) |
| **Architecture** | [ARCHITECTURE.md](./ARCHITECTURE.md) |

---

## 1. Wallet Setup

### Install Freighter
1. Install [Freighter Wallet](https://freighter.app/) browser extension (Chrome/Firefox/Edge)
2. Create a new wallet or import existing
3. Switch to **Stellar Testnet**:
   - Open Freighter → Settings → Network → **Testnet**

### Fund Your Wallet
Get test XLM + USDC from Stellar Friendbot:
```
https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY
```

For USDC, use the **Get 50 Test USDC** button on the dashboard, or fund manually via Stellar Laboratory.

---

## 2. App Pages & Features

### Landing Page (`/`)
Wallet connect + feature highlights + how-it-works timeline.
- Click **Connect Freighter** to connect
- Shows connected address + network badge (Testnet)

### Dashboard (`/dashboard`)
Your command center:
- **Member Profile card** — wallet address (copyable), reputation badge, established status
- **Reputation Score card** — composite score (0–1000), on-time payment ratio bar
- **Active Chit Pools card** — count of groups you've joined
- **SEP-24 Ramp** — deposit/withdraw USDC via bank transfer (interactive anchor flow)
- **Your Saving Groups** — list of groups you belong to, click any to enter details

### Analytics & Monitoring (`/analytics`)
**New — added for Level 4 Green Belt.** Real-time on-chain insights:
- **Total Pooled Value** — USDC sum across all your groups
- **Group States** — active vs completed, per-state breakdown badges
- **Network Status** — live indicator, RPC endpoint, wallet network, network passphrase
- **Reputation** — composite score, on-time percentage, established status
- **Activity Log** — scrollable timeline of wallet connects, group loads, contract events (persisted in localStorage, survives page refreshes)
- **Group Breakdown** — table with contract ID, state, members, cycle progress, contribution, pool size for every group

### Profile (`/profile`)
Detailed on-chain reputation:
- Composite reputation score (0–1000)
- On-time payment ratio
- Payment history (on-time, total due, defaults)
- Cycles completed, bids won
- Disputes raised/lost
- Established status badge

### Create Group (`/create-group`)
Form to deploy a new chit group:
- **Contribution Amount** (USDC)
- **Number of Members**
- **Number of Cycles**
- **Min Attestation Score** (anti-sybil gate)
- **Min Reputation for Bidding**
- Signs a factory contract call — group contract deployed dynamically

### Group Details (`/group/[id]`)
Full group lifecycle management:
- **Group Info** — admin, state, contribution, current cycle, pool size
- **Members list** — with payment status per cycle
- **Admin controls** — Start Collection, Execute Payout, Advance Cycle, Pause/Unpause
- **Contribution Flow** — Pay Contribution button
- **Bidding Panel** — commit SHA-256 bid hash, reveal bid with amount + nonce
- **Raise Dispute** button (opens dispute modal)

### Disputes (`/disputes`)
Multi-sig arbitration panel:
- List of disputes with status (Open/Voting/Resolved/Dismissed)
- Raise new dispute linked to a group
- Arbitrators cast votes (in favor / against) with decision type
- Dispute resolves automatically when threshold (3-of-5) is reached

---

## 3. On-Chain Activity (Real Testnet Users)

13 testnet users actively participating across 2 chit groups:

| Detail | Group A | Group B |
|--------|---------|---------|
| **Contract** | `CC2BGN75IGEWLOCRB3NLZO5HBHEH3NGBE6QNUONOVMGFMTEIPV2W5GER` | `CBWO3KSGJM7TXTKONLDELGGOPQ42XZZZBXW2LTOFK6YSYB4KUONGQILA` |
| **Create Tx** | `32b2d0d53ba1778d9045cf3404002983f1c46e70a716b1f0930fc2c5821b3f5e` | `9bf22151414338b2e78e6d39f822a9b49eace3627bc68323d7c59e304ad2a035` |
| **Members** | 10 | 3 |
| **Contribution** | 5 USDC/cycle | 2.5 USDC/cycle |
| **Cycles** | 3 | 6 |
| **Verify** | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CC2BGN75IGEWLOCRB3NLZO5HBHEH3NGBE6QNUONOVMGFMTEIPV2W5GER) | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBWO3KSGJM7TXTKONLDELGGOPQ42XZZZBXW2LTOFK6YSYB4KUONGQILA) |

All wallets funded via Stellar Friendbot. Every join transaction is a real Soroban contract call on testnet.

### View This Data in the App
The groups were created with the admin wallet:
```
Public: GDJFMVPEBMOYMYHPEHXODG4WLDSTQBD66CEDHQS7WQM7VDGGOJVSN6PR
Secret: SDLCGLQDC72C5WRR7IX3E74TJE46SIKIDB52ANJQMGHNQSDJ5SJZFWUG
```
Import this secret into Freighter → connect → see all 2 groups + 13 users on dashboard + analytics.

---

## 4. Monitoring & Analytics

| Feature | Where | What It Shows |
|---------|-------|---------------|
| **Vercel Analytics** | Vercel Dashboard | Page views, unique visitors, Core Web Vitals |
| **In-App Analytics** | `/analytics` page | Pooled value, group states, network status, reputation |
| **Activity Log** | `/analytics` page | Session event timeline (wallet, contract, group actions) |
| **Error Tracking** | Toast notifications | Simulation errors, transaction failures, wallet errors |

---

## 5. Smart Contracts

| Contract | Address | LOC | Purpose |
|----------|---------|-----|---------|
| **Factory** | `CAJBU4IDXR5PFHY3AKRDUS2LTRID7ONORUXJJYG5LDPTG2QMREINLF6V` | 165 | Dynamic group deployment |
| **Reputation** | `CDA53WAWFZ2VVOXUUXNQWVETL3KX5DTZ4O6YWNFKJIGNKLBF3NZ5HGSR` | 674 | On-chain scoring |
| **Identity** | `CAG3PALD7IHTXSJHIAVWWF2N6YICTMU2EO5JK5O3DC7HEJVU4L5JSSSL` | 416 | Sybil-resistant vouching |
| **Dispute** | `CCX3JYBOO3LHIRKIDXTO755OBUL6W7GSZKPFNPWCTN3NNLZU2WX4OK3B` | 862 | Multi-sig arbitration |
| **USDC** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | — | Testnet USDC token |

All deployed on **Stellar Testnet** — Soroban RPC: `https://soroban-testnet.stellar.org`

---

## 6. Demo Video Script (2 minutes)

### Scene 1: Landing & Connect (0:00 – 0:20)
- Open `chain-chit.vercel.app`
- Connect Freighter wallet
- Show connected state with address + network badge

### Scene 2: Dashboard & Profile (0:20 – 0:40)
- Dashboard: reputation score, groups count, SEP-24 ramp
- Profile page: composite score breakdown, payment history

### Scene 3: Analytics & Monitoring (0:40 – 0:55)
- Navigate to `/analytics`
- Show pooled value, group states, live network indicator
- Scroll activity log showing session events

### Scene 4: Create & Manage a Group (0:55 – 1:20)
- Create Group form → fill params → sign tx
- Dashboard showing new group
- Group details: info, members, current cycle

### Scene 5: Bidding Flow (1:20 – 1:35)
- Commit bid (SHA-256 hash submitted on-chain)
- Reveal bid (verify commitment)
- Show bid status

### Scene 6: SEP-24 Fiat Ramp (1:35 – 1:50)
- Dashboard → Deposit USDC
- Interactive anchor window
- Transaction status

### Scene 7: Wrap Up (1:50 – 2:00)
- Quick mention: dispute resolution, on-chain reputation, 13 testnet users active
- Link to live app + GitHub repo

---

## 7. Screenshots Needed for Submission

| # | Screenshot | Where to Capture |
|---|------------|------------------|
| 1 | Wallet connected state | Landing page after connect — show address + network badge |
| 2 | Balance display | Dashboard — reputation score + groups count visible |
| 3 | Successful testnet transaction | Group details after join/contribute/bid — show tx hash or toast |
| 4 | Analytics dashboard | `/analytics` — show pooled value, group states, network status |
| 5 | Activity feed | `/analytics` — scrollable event log with timestamps |
| 6 | Mobile responsive UI | Resize browser to mobile viewport — show responsive layout |

Save screenshots in `docs/screenshots/` and reference them in the README.

---

## 8. Submission Checklist

### Level 4 — Green Belt
- [x] **Live demo**: [chain-chit.vercel.app](https://chain-chit.vercel.app/)
- [x] **Monitoring & analytics**: Vercel Analytics + in-app `/analytics` page
- [x] **Mobile responsive**: Tailwind responsive breakpoints throughout
- [x] **15+ commits**: 60+ commits
- [x] **Contract deployment**: 5 contracts on testnet (addresses above)
- [x] **13 testnet users**: Funded + joined groups with on-chain tx proofs
- [ ] **Demo video**: Upload to YouTube → paste link in README
- [ ] **Screenshots**: Capture + add to `docs/screenshots/`

### Level 5 — Blue Belt
- [x] **Pitch deck**: [View on Canva](https://canva.link/6rhc38gmfemtrzn) (13 slides)
- [x] **20+ commits**: 60+ commits
- [ ] **50 testnet users**: Need 37 more funded wallets with interactions
- [ ] **Google Form**: For user feedback collection
- [ ] **Product improvements**: Based on feedback
- [ ] **Demo video**: Full walkthrough recording
