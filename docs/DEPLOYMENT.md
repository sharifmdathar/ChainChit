# Deployment Guide

## Prerequisites

- Rust 1.75+ with `wasm32-unknown-unknown` target
- Node.js 20+
- [soroban-cli](https://github.com/stellar/soroban-cli) installed
- A Stellar account with XLM for fees (testnet or mainnet)
- A Stellar wallet extension (Freighter recommended)

## Step 1: Build Contracts

```bash
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release
```

WASM outputs are in `target/wasm32-unknown-unknown/release/`.

## Step 2: Run Tests

```bash
cargo test
```

All tests must pass before deploying.

## Step 3: Fund Admin Account

### Testnet

```bash
# Fund account via friendbot
curl "https://friendbot.stellar.org?addr=<ADMIN_PUBLIC_KEY>"
```

### Mainnet

Transfer XLM to the admin address for transaction fees. Recommended: use a hardware wallet or multi-sig for the admin key.

## Step 4: Deploy Contracts

### Automated (Recommended)

```bash
export SOROBAN_SECRET_KEY=S...  # Admin secret key
NETWORK=testnet npx ts-node scripts/deploy.ts
```

The script:
1. Builds all contract WASMs
2. Deploys in dependency order (Reputation → Identity → Dispute → ChitGroup)
3. Initializes each contract with the admin address and cross-contract references
4. Writes contract IDs to `frontend/.env.local`

### Manual

```bash
# Deploy Reputation
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/reputation.wasm \
  --source <SECRET> \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org

# Initialize Reputation
soroban contract invoke \
  --id <REPUTATION_ID> \
  --source <SECRET> \
  --network-passphrase "Test SDF Network ; September 2015" \
  --rpc-url https://soroban-testnet.stellar.org \
  -- initialize --admin <ADMIN> --authorized_group <CHIT_GROUP_ID>

# Repeat for Identity, Dispute, ChitGroup...
```

## Step 5: Configure Frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` with deployed contract IDs:

```
NEXT_PUBLIC_NETWORK=TESTNET
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CHIT_GROUP_CONTRACT=<ID>
NEXT_PUBLIC_REPUTATION_CONTRACT=<ID>
NEXT_PUBLIC_IDENTITY_CONTRACT=<ID>
NEXT_PUBLIC_DISPUTE_CONTRACT=<ID>
NEXT_PUBLIC_USDC_CONTRACT=<USDC_SAC_ID>
NEXT_PUBLIC_ANCHOR_SEP24_URL=<ANCHOR_URL>
```

### USDC Contract

On testnet, use the USDC SAC contract ID:
```
CCW67TSUGAEKE6SPMB5IKCTXZQH5HM6F3TGH4XLCSKL5Y5HEKUC7OS2A
```

On mainnet, use the official USDC contract:
```
CC6D2FO3M4Y5J4U4RPE7NDJ5A2HDGCTWP6UOBZB4DX5XQET3JHBQ5OCG
```

## Step 6: Deploy Frontend

### Vercel (Recommended)

```bash
cd frontend
npx vercel --prod
```

Set the environment variables in the Vercel dashboard under Project → Settings → Environment Variables.

### Docker

```bash
cd frontend
docker build -t chainchit-frontend .
docker run -p 3000:3000 chainchit-frontend
```

### Standalone

```bash
cd frontend
npm run build
npm start
```

## Step 7: Post-Deployment Verification

1. **Connect wallet** — verify Freighter/xBull/Lobstr connection works
2. **Create a test group** — small contribution, 2 members, 2 cycles
3. **Join and pay** — both members contribute
4. **Bid** — commit and reveal phase
5. **Payout** — verify lowest unique bid wins
6. **Reputation** — check composite score updates on the profile page
7. **Dispute** — raise a dispute, vote, verify resolution
8. **Pause/Unpause** — test emergency circuit breaker

## Upgrading Contracts

To upgrade a contract after deployment:

1. Deploy the new WASM with `soroban contract deploy`.
2. Use `update_contracts()` on the ChitGroup contract to update linked addresses.
3. Use `set_reputation_contract()` on Identity to update the Reputation address.
4. Update `frontend/.env.local` with the new contract ID.

**Note:** Soroban contracts are immutable once deployed. "Upgrading" means deploying a new instance and migrating references.

## Monitoring

- **Stellar Explorer**: Track transactions at https://stellar.expert/explorer/testnet
- **RPC Health**: Monitor `getHealth` endpoint of your Soroban RPC node
- **Frontend Errors**: Use Sentry or similar for client-side error tracking
- **Contract Events**: Index `contractevent` via Soroban RPC's `getEvents` for real-time contract activity

## Rollback Plan

1. Call `pause()` on the ChitGroup contract to halt all state transitions.
2. Deploy a new contract instance with fixes.
3. Use `update_contracts()` to point to the new addresses.
4. Unpause the group contract.

Data is preserved in the original contract instances. Migration scripts may be needed for complex state changes.
