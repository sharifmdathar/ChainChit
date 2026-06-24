# ChainChit Architecture

## System Overview

ChainChit is a decentralized chit fund platform on Stellar. Four Soroban smart contracts coordinate group savings, reputation, identity verification, and dispute resolution. A Next.js frontend provides wallet-connected interaction via Soroban RPC.

---

## Contract Architecture

### Dependency Graph

```
ChitGroup ──→ Reputation (record payments, defaults, bid wins)
         ──→ Identity   (check attestation before allowing membership)
         ──→ Dispute    (raise disputes, trigger resolution)

Identity  ──→ Reputation (lookup vouchor score for attestation weight)

Dispute   ──→ Reputation (record dispute outcomes)
```

All cross-contract calls flow through `env.invoke_contract()`. No contract calls another contract back (no reentrancy).

### ChitGroup Contract

**Storage Layout:**

| Key Type | Scope | Data |
|----------|-------|------|
| Instance | Admin, config, state | `DataKey::Admin`, `DataKey::Token`, `DataKey::NumMembers`, etc. |
| Instance | Linked contracts | `DataKey::ReputationContract`, `DataKey::IdentityContract`, `DataKey::DisputeContract` |
| Persistent | Per-member | `DataKey::Members(Address)` → `MemberStatus` |
| Persistent | Per-cycle | `DataKey::CycleState(u32)` → `CycleState` |

**State Machine:**

```
         join_group()          pay_contribution()      all paid → auto
Forming ──────────→ Collecting ──────────→ Bidding ──────────→ Payout
  ↑                                                    │
  │              admin: pause()                         │
  └──────────── Paused ←─────────────────────────────┘
                  │
                  └── unpause() → resumes previous state

Payout → advance_cycle() → Collecting (next cycle)
Payout → advance_cycle() → Completed (final cycle)
```

**Commit-Reveal Scheme:**

1. Member calls `commit_bid(commitment: Vec<u8>)` where `commitment = SHA-256(amount_le_64 || nonce_le_64)`.
2. On-chain stores `(commitment, revealed: false, amount: 0)`.
3. Member calls `reveal_bid(amount, nonce)`. Contract recomputes SHA-256 and verifies match.
4. `execute_payout()` finds the lowest unique bid: the smallest `amount` with exactly one bidder.

### Reputation Contract

**Score Composition (0–1000):**

| Factor | Weight | Calculation |
|--------|--------|-------------|
| On-time payment ratio | 60% | `(on_time_payments / total_payments_due) × 600` |
| Cycle completion | 20% | `(cycles_completed / total_cycles_seen) × 200` |
| Dispute record | 10% | `max(0, 100 - disputes_lost × 20) × 1` |
| Bid history | 10% | `min(bids_won, 5) × 20` |

**Access Control:** Uses `AuthorizedGroup` pattern — only whitelisted ChitGroup contract addresses can call `record_*` functions. Admin manages the authorized set.

**On-Time Ratio:** Stored as basis points (0–10000) for on-chain precision without floating point.

### Identity Contract

**Sybil Resistance:** Attestation weight equals the vouchor's reputation composite score at the time of vouching. Fake accounts (score 0) carry zero weight, making Sybil attacks economically infeasible.

**Flow:**
1. Member A (reputation 750) vouches for Member B → weight 750 recorded.
2. Member C (reputation 400) vouches for Member B → weight 400 recorded.
3. Member B's attestation score = 750 + 400 = 1150.
4. If `min_attestation_weight ≤ 1150`, Member B passes the attestation check.

**Guards:** Self-attestation rejected. Duplicate attestation (same vouchor → same vouchee) rejected.

### Dispute Contract

**Multi-Sig Arbitration:**
- Configurable arbitrator set (minimum 3 at initialization).
- `required_votes` threshold for resolution (e.g., 3-of-5).
- Auto-resolution: when `votes_for ≥ required_votes` → resolves in favor. When `votes_against ≥ required_votes` → dismissed.
- Admin override: `resolve_dispute()` for edge cases.
- On resolution, `record_dispute_outcome()` is called on the Reputation contract.

**Dispute Decisions:**

| Decision | Effect |
|----------|--------|
| `Dismiss` | No action taken |
| `ReversePayout` | Winner forfeits payout (needs manual iteration in ChitGroup) |
| `ForceDefault` | Accused member marked as Defaulted |
| `PartialRefund` | Custom settlement (needs manual execution) |

---

## Frontend Architecture

### Stack

- **Next.js 14** with App Router and `"use client"` pages
- **@creit.tech/stellar-wallets-kit** for wallet connection (Freighter, xBull, Lobstr)
- **@stellar/stellar-sdk** for Soroban RPC: simulation, transaction building, signing
- **Tailwind CSS** with custom `stellar` (blue) and `chit` (dark) color palettes

### Module Layout

```
src/
├── app/                    # Route pages
│   ├── page.tsx            # Landing + wallet connect
│   ├── dashboard/          # Reputation summary, SEP-24 ramp, groups grid
│   ├── create-group/       # Group creation form
│   ├── group/[id]/         # Group detail: state-dependent actions
│   ├── profile/            # Reputation display + attestation flow
│   └── disputes/           # Dispute list + modal
├── components/
│   ├── Navbar.tsx          # Fixed nav bar
│   ├── WalletProvider.tsx  # Context re-export
│   ├── GroupCard.tsx       # Group card with state badge
│   ├── ReputationBadge.tsx # Color-coded score indicator
│   ├── ContributionFlow.tsx# Two-step pay flow
│   ├── BiddingPanel.tsx    # Commit-reveal UI
│   ├── AttestationFlow.tsx # Vouch for members
│   ├── DisputeModal.tsx    # Vote + view dispute
│   └── Sep24Ramp.tsx       # INR deposit/withdraw
├── hooks/
│   ├── useWallet.tsx       # Wallet context provider
│   ├── useChitGroup.ts     # Group CRUD operations
│   ├── useReputation.ts    # Score + on-time ratio
│   ├── useIdentity.ts      # Attestation queries
│   └── useDispute.ts       # Dispute queries + vote
├── lib/
│   ├── stellar.ts          # Wallet kit, RPC, sign/send, ScVal helpers
│   ├── contracts.ts        # All contract invocations + parsers
│   └── utils.ts            # Formatting, SHA-256, color helpers
└── types/
    └── index.ts             # Shared TypeScript interfaces
```

### Transaction Flow

```
User Action → Hook (withLoading) → contracts.ts (invokeContract)
    → stellar.ts (simulate → setSorobanAuth → sign → send → poll)
    → Toast notification (success/error)
```

Every write operation:
1. Simulates the transaction to get the footprint and auth.
2. Sets Soroban authorization entries if required.
3. Signs via wallet kit.
4. Sends to RPC and polls for confirmation (up to 20s).
5. Returns the simulation return value for reads, or confirm vía toast.

### SEP-24 Integration

The `Sep24Ramp` component opens anchor-hosted interactive KYC/deposit/withdraw flows in a popup window. The anchor URL is configured via `NEXT_PUBLIC_ANCHOR_SEP24_URL`. When not configured, the UI shows a graceful fallback message.

---

## Security Considerations

1. **No Reentrancy**: Contracts call downstream (ChitGroup→Reputation) never back. Single-direction call graph.
2. **Commit-Reveal**: Bids are hidden during commit phase, preventing front-running.
3. **Authorization**: `require_auth()` on all mutating functions. Only authorized group contracts can write to Reputation.
4. **Emergency Pause**: Circuit-breaker pattern halts all state transitions.
5. **Sybil Resistance**: Identity attestation weights derived from reputation — zero-rep accounts carry zero weight.
6. **Integer Safety**: Rust's `saturating_add` and checked arithmetic used throughout. No floating-point on-chain.

See [SECURITY_AUDIT_CHECKLIST.md](./SECURITY_AUDIT_CHECKLIST.md) for the full pre-deployment checklist.
