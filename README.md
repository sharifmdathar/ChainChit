# ChainChit — On-Chain Chit Fund Platform on Stellar

**Live Demo**: [chain-chit.vercel.app](https://chain-chit.vercel.app/)

A production-ready decentralized chit fund (committee/rotating savings) platform built on Stellar Soroban smart contracts with a Next.js frontend.

## What is a Chit Fund?

A chit fund is a rotating savings scheme where a group of members contribute a fixed amount each cycle. One member wins the pooled amount each cycle through a competitive bidding process. The lowest unique bid wins — incentivizing participants to bid the smallest fee they're willing to accept for early pool access.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js Frontend               │
│  (Stellar Wallets Kit · Soroban RPC · SEP-24)   │
└──────────┬──────────┬──────────┬────────────────┘
           │          │          │
    ┌──────┴──┐ ┌─────┴───┐ ┌────┴─────┐
    │ ChitGroup│ │Identity │ │ Dispute  │
    │ Contract │ │Contract │ │ Contract │
    └──────┬──┘ └────┬────┘ └────┬─────┘
           │         │           │
           └─────────┼───────────┘
                     │
              ┌──────┴──────┐
              │  Reputation │
              │   Contract  │
              └─────────────┘
```

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| **ChitGroup** | Core chit fund logic — group lifecycle, contributions, commit-reveal bidding, payouts |
| **Reputation** | On-chain reputation tracking — on-time payments, defaults, composite score (0–1000) |
| **Identity** | Sybil-resistant attestation — vouches weighted by vouchor's reputation score |
| **Dispute** | Multi-sig arbitration — 3-of-5 arbitrator voting with on-chain resolution |

### Key Features

- **Commit-Reveal Bidding**: SHA-256 commitment scheme hides bids until reveal phase. Lowest unique bid wins the pool.
- **Reputation System**: Composite score (0–1000) computed from payment history, cycle completions, dispute outcomes, and bid history.
- **Sybil-Resistant Identity**: Attestation weight equals the vouchor's reputation score — fake accounts with zero reputation carry zero weight.
- **Multi-Sig Disputes**: 3-of-5 arbitrator panel with automatic threshold resolution and on-chain enforcement.
- **Emergency Pause**: Admin-controlled circuit breaker halts all state transitions.
- **SEP-24 INR Ramp**: Anchor integration for bank-to-USDC deposits and withdrawals.

## Demo

**Live Application**: [chain-chit.vercel.app](https://chain-chit.vercel.app/)

**Demo Video**: *[Placeholder — link will be added after upload to YouTube]*

**Pitch Deck**: [ChainChit_Pitch_Deck.pptx](docs/ChainChit_Pitch_Deck.pptx)

## On-Chain Activity

13 testnet users have funded their wallets via Stellar Friendbot, joined chit groups, and are actively participating across 2 groups:

| Detail | Group A | Group B |
|--------|---------|---------|
| **Contract** | `CC2BGN75IGEWLOCRB3NLZO5HBHEH3NGBE6QNUONOVMGFMTEIPV2W5GER` | `CBWO3KSGJM7TXTKONLDELGGOPQ42XZZZBXW2LTOFK6YSYB4KUONGQILA` |
| **Create Tx** | `32b2d0d53ba1778d9045cf3404002983f1c46e70a716b1f0930fc2c5821b3f5e` | `9bf22151414338b2e78e6d39f822a9b49eace3627bc68323d7c59e304ad2a035` |
| **Members** | 10 | 3 |
| **Contribution** | 5 USDC/cycle | 2.5 USDC/cycle |
| **Cycles** | 3 | 6 |
| **Verify** | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CC2BGN75IGEWLOCRB3NLZO5HBHEH3NGBE6QNUONOVMGFMTEIPV2W5GER) | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBWO3KSGJM7TXTKONLDELGGOPQ42XZZZBXW2LTOFK6YSYB4KUONGQILA) |

## Contract Deployment (Testnet)

| Contract | Address |
|----------|---------|
| **Factory** | `CAJBU4IDXR5PFHY3AKRDUS2LTRID7ONORUXJJYG5LDPTG2QMREINLF6V` |
| **ChitGroup** | Deployed dynamically via factory |
| **Reputation** | `CDA53WAWFZ2VVOXUUXNQWVETL3KX5DTZ4O6YWNFKJIGNKLBF3NZ5HGSR` |
| **Identity** | `CAG3PALD7IHTXSJHIAVWWF2N6YICTMU2EO5JK5O3DC7HEJVU4L5JSSSL` |
| **Dispute** | `CCX3JYBOO3LHIRKIDXTO755OBUL6W7GSZKPFNPWCTN3NNLZU2WX4OK3B` |
| **USDC** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |

Network: **Stellar Testnet** (Soroban RPC: `https://soroban-testnet.stellar.org`)

## Monitoring & Analytics

- **Vercel Analytics** — Page views and Core Web Vitals tracking (built-in with Vercel deployment)
- **Error Monitoring** — Console error logging via `react-hot-toast` with structured error messages for simulation failures, transaction timeouts, and wallet errors
- **Transaction Status** — On-chain transaction polling with status tracking (pending → success/fail) with full XDR error details

## Screenshots

> *Screenshots to be added:*
> - Wallet connected state
> - Balance display
> - Successful testnet transaction with hash

## Quick Start

### Prerequisites

- Rust 1.84+ with `wasm32v1-none` target
- Node.js 20+
- A Stellar wallet (Freighter recommended)

### Build Contracts

```bash
# Add WASM target if needed
rustup target add wasm32v1-none

# Build all contracts
stellar contract build
```

### Run Tests

```bash
cargo test
```

### Frontend

```bash
cd frontend
npm install

# Copy env template and fill in contract IDs after deployment
cp .env.local.example .env.local

npm run dev
```

### Deploy Contracts

```bash
# Set admin secret key
export SOROBAN_SECRET_KEY=S...

# Deploy to testnet
NETWORK=testnet npx ts-node scripts/deploy.ts
```

The deploy script outputs contract IDs and writes them to `frontend/.env.local`.

## Contract Lifecycle

```
Forming → Collecting → Bidding → Payout → (next cycle or Completed)
   ↑          ↓
   └──── Pause └──→ Unpause
```

1. **Forming**: Admin creates group with contribution amount, member count, and cycle count.
2. **Collecting**: Members join and pay contributions for the current cycle.
3. **Bidding**: Members commit sealed bids (SHA-256), then reveal them.
4. **Payout**: Lowest unique bid wins the pool. Payout is disbursed.
5. **Completed**: After all cycles finish, the group closes.

## Bidding Mechanics

The platform uses a **commit-reveal** scheme to prevent bid sniping:

1. **Commit Phase**: Member submits `SHA-256(amount_le || nonce_le)`. The bid amount is hidden.
2. **Reveal Phase**: Member reveals their amount and nonce. The commitment is verified on-chain.
3. **Lowest Unique Bid Wins**: The member with the smallest bid that no one else matched wins the pool for that cycle.

The bid amount is the fee a member accepts for early access to the pooled funds. Lower bids are more competitive.

## Tech Stack

- **Contracts**: Rust + Soroban SDK v22
- **Frontend**: Next.js 14 (App Router) + TypeScript (strict mode)
- **Wallet**: @creit.tech/stellar-wallets-kit (Freighter, xBull, Lobstr)
- **Blockchain**: Stellar + Soroban RPC
- **Fiat Ramp**: SEP-24 anchor integration (INR ↔ USDC)
- **Styling**: Tailwind CSS with custom stellar/chit theme

## Project Structure

```
chainChit/
├── contracts/
│   ├── chit_group/     # Core chit fund contract
│   ├── reputation/     # On-chain reputation tracking
│   ├── identity/       # Attestation/vouching system
│   └── dispute/        # Multi-sig arbitration
├── frontend/
│   ├── src/
│   │   ├── app/        # Next.js App Router pages
│   │   ├── components/ # React components
│   │   ├── hooks/      # Wallet & contract hooks
│   │   ├── lib/        # Stellar SDK, contract calls, utils
│   │   └── types/      # TypeScript interfaces
│   └── ...
├── scripts/
│   └── deploy.ts       # Contract deployment script
├── .github/
│   └── workflows/
│       └── ci.yml      # CI pipeline
└── docs/
    ├── ARCHITECTURE.md
    ├── CONTRACT_API.md
    ├── DEPLOYMENT.md
    └── SECURITY_AUDIT_CHECKLIST.md
```

## License

MIT
