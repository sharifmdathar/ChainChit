# ChainChit — On-Chain Chit Fund Platform on Stellar

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

## Quick Start

### Prerequisites

- Rust 1.75+ with `wasm32-unknown-unknown` target
- Node.js 20+
- A Stellar wallet (Freighter recommended)

### Build Contracts

```bash
# Add WASM target if needed
rustup target add wasm32-unknown-unknown

# Build all contracts
cargo build --target wasm32-unknown-unknown --release
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
