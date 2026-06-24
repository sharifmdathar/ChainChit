# ChainChit Contract API Reference

## ChitGroup Contract

### Initialization

```rust
fn initialize(
    env: Env,
    admin: Address,
    token: Address,               // USDC SAC contract
    reputation_contract: Address,
    identity_contract: Address,
    dispute_contract: Address,
    contribution_amount: u64,      // per-member per-cycle, in token units
    num_members: u32,
    total_cycles: u32,
    min_attestation_score: u32,   // minimum attestation score to join
    min_reputation_for_bid: u32,  // in basis points (0–10000)
) -> Result<(), Error>
```

**Requires:** `admin.require_auth()`
**Errors:** `AlreadyInitialized` if called twice.

### Group Lifecycle

#### `join_group(env, caller: Address) -> Result<(), Error>`

Join the group during the `Forming` state.

- **Requires:** `caller.require_auth()`, `caller` must pass attestation check via Identity contract.
- **Errors:** `NotForming`, `GroupFull`, `AlreadyMember`, `AttestationFailed`.

#### `start_collection(env, caller: Address) -> Result<(), Error>`

Transition from `Forming` to `Collecting`. All member slots must be filled.

- **Requires:** `caller.require_auth()`, caller must be admin.
- **Errors:** `NotForming`, `NotAdmin`, `GroupNotFull`.

#### `pay_contribution(env, caller: Address) -> Result<(), Error>`

Pay contribution for the current cycle. Auto-transitions to `Bidding` when all members have paid.

- **Requires:** `caller.require_auth()`.
- **Errors:** `NotCollecting`, `AlreadyPaid`, `NotMember`.
- **Side Effects:** Calls `Reputation::record_payment()` on success.

#### `advance_cycle(env, caller: Address) -> Result<(), Error>`

Move to the next cycle after payout is complete.

- **Requires:** `caller.require_auth()`, caller must be admin.
- **Errors:** `NotPayout`, `NotAdmin`.
- **Side Effects:** Calls `Reputation::record_group_cycle_completed()` for all paid members. Transitions to `Completed` on the final cycle.

### Bidding

#### `commit_bid(env, caller: Address, commitment: Vec<u32>) -> Result<(), Error>`

Submit a sealed bid commitment during the `Bidding` state.

- **Commitment:** `SHA-256(amount_le_64 || nonce_le_64)` as a 32-byte vector.
- **Requires:** `caller.require_auth()`, caller reputation must meet `min_reputation_for_bid`.
- **Errors:** `NotBidding`, `AlreadyCommitted`, `NotMember`, `InsufficientReputation`.

#### `reveal_bid(env, caller: Address, amount: u64, nonce: u64) -> Result<(), Error>`

Reveal a previously committed bid. Contract verifies SHA-256 match.

- **Requires:** `caller.require_auth()`.
- **Errors:** `NotBidding`, `AlreadyRevealed`, `CommitmentMismatch`, `NotCommitted`.

#### `execute_payout(env, caller: Address) -> Result<(), Error>`

Execute payout to the lowest unique bidder.

- **Requires:** `caller.require_auth()`, at least one bid must be revealed.
- **Errors:** `NotBidding`, `NoBidsRevealed`, `NotAdmin`.
- **Side Effects:** Transfers pool tokens to winner. Calls `Reputation::record_bid_won()`. Transitions state to `Payout`.

### Disputes

#### `raise_dispute(env, caller: Address, cycle: u32, reason: String) -> Result<(), Error>`

Raise a dispute for a given cycle. Delegates to Dispute contract.

- **Requires:** `caller.require_auth()`, caller must be a group member.
- **Errors:** `NotMember`, `DisputeFailed`.

### Admin Functions

#### `pause(env, caller: Address) -> Result<(), Error>`

Halt all state transitions. Only callable by admin.

- **Errors:** `NotAdmin`, `AlreadyPaused`.

#### `unpause(env, caller: Address) -> Result<(), Error>`

Resume operations from paused state.

- **Errors:** `NotAdmin`, `NotPaused`.

#### `update_contracts(env, caller: Address, reputation: Address, identity: Address, dispute: Address) -> Result<(), Error>`

Update linked contract addresses. Only callable by admin.

- **Errors:** `NotAdmin`.

### View Functions

| Function | Returns |
|----------|---------|
| `get_group_info(env)` | `GroupInfo` — admin, token, state, cycle, config |
| `get_members(env)` | `Vec<Address>` — all member addresses |
| `get_cycle_state(env, cycle: u32)` | `CycleState` — payments map, bids, winner, winning_bid |
| `get_member_payment_status(env, cycle: u32, member: Address)` | `MemberStatus` — Pending/Paid/Defaulted/Disputed |

---

## Reputation Contract

### Initialization

```rust
fn initialize(env: Env, admin: Address, authorized_group: Address) -> Result<(), Error>
```

Sets admin and the initial authorized ChitGroup contract address.

### Recording Functions (Authorized Callers Only)

| Function | Parameters | Effect |
|----------|-----------|--------|
| `record_payment` | `group, member` | Increments `on_time_payments` and `total_payments_due` |
| `record_default` | `group, member` | Increments `cycles_defaulted` and `total_payments_due` |
| `record_bid_won` | `group, member` | Increments `bids_won` |
| `record_group_cycle_completed` | `group, member` | Increments `cycles_completed` |
| `record_dispute_outcome` | `group, member, won: bool` | Increments `disputes_raised`; if lost, increments `disputes_lost` |

All require `caller.require_auth()` and `caller` must be an authorized group contract.

### View Functions

| Function | Returns |
|----------|---------|
| `get_reputation(env, address)` | `ReputationData` — full data struct |
| `get_on_time_ratio(env, address)` | `u32` — basis points (0–10000), 0 if no payments |
| `get_composite_score(env, address)` | `u32` — weighted score 0–1000 |
| `is_established(env, address)` | `bool` — true if composite score ≥ 500 |

### Admin Functions

| Function | Parameters | Effect |
|----------|-----------|--------|
| `authorize_group` | `caller, group` | Add group to authorized set |
| `revoke_group` | `caller, group` | Remove group from authorized set |

---

## Identity Contract

### Initialization

```rust
fn initialize(
    env: Env,
    admin: Address,
    reputation_contract: Address,
    min_attestation_weight: u32,
) -> Result<(), Error>
```

### Functions

#### `vouch(env, vouchor: Address, vouchee: Address) -> Result<(), Error>`

Vouch for another address. Weight = vouchor's composite reputation score.

- **Requires:** `vouchor.require_auth()`.
- **Errors:** `SelfAttestation`, `DuplicateAttestation`, `ReputationNotSet`.

#### `get_attestation_score(env, vouchee: Address) -> u32`

Sum of all attestation weights received.

#### `is_attested(env, vouchee: Address) -> bool`

Returns `true` if attestation score ≥ `min_attestation_weight`.

#### `get_vouchors(env, vouchee: Address) -> Vec<Address>`

List of all addresses that vouched for vouchee.

#### `get_attestation_count(env, vouchee: Address) -> u32`

Number of vouches received.

### Admin Functions

| Function | Effect |
|----------|--------|
| `set_reputation_contract(caller, address)` | Update the Reputation contract address |
| `set_min_weight(caller, weight)` | Update the minimum attestation threshold |

---

## Dispute Contract

### Initialization

```rust
fn initialize(
    env: Env,
    admin: Address,
    arbitrators: Vec<Address>,   // minimum 3
    required_votes: u32,         // minimum 2, must be ≤ arbitrators.len()
    reputation_contract: Address,
) -> Result<(), Error>
```

**Errors:** `TooFewArbitrators`, `InvalidRequiredVotes`, `AlreadyInitialized`.

### Functions

#### `raise_dispute(env, caller: Address, cycle: u32, reason: String) -> Result<u32, Error>`

Create a new dispute. Returns the dispute ID.

- **Requires:** `caller.require_auth()`, caller must be an authorized group contract.
- **Errors:** `Unauthorized`.

#### `cast_vote(env, caller: Address, dispute_id: u32, support: bool) -> Result<(), Error>`

Vote on a dispute. Auto-resolves when threshold is met.

- **Requires:** `caller.require_auth()`, caller must be an arbitrator.
- **Errors:** `NotArbitrator`, `DisputeNotFound`, `AlreadyVoted`, `AlreadyResolved`.

#### `resolve_dispute(env, caller: Address, dispute_id: u32, decision: DisputeDecision) -> Result<(), Error>`

Admin override to resolve a dispute.

- **Requires:** `caller.require_auth()`, caller must be admin.
- **Errors:** `NotAdmin`, `DisputeNotFound`, `AlreadyResolved`.

### View Functions

| Function | Returns |
|----------|---------|
| `get_dispute(env, id: u32)` | `DisputeRecord` or error |
| `get_arbitrators(env)` | `Vec<Address>` |

### Admin Functions

| Function | Effect |
|----------|--------|
| `add_arbitrator(caller, address)` | Add to arbitrator set (admin only) |
| `remove_arbitrator(caller, address)` | Remove from arbitrator set (admin only) |

---

## Error Codes

### ChitGroup Errors

| Code | Name |
|------|------|
| 1 | NotAdmin |
| 2 | NotForming |
| 3 | NotCollecting |
| 4 | NotBidding |
| 5 | NotPayout |
| 6 | AlreadyInitialized |
| 7 | GroupFull |
| 8 | AlreadyMember |
| 9 | NotMember |
| 10 | AlreadyPaid |
| 11 | GroupNotFull |
| 12 | InsufficientReputation |
| 13 | AttestationFailed |
| 14 | AlreadyCommitted |
| 15 | AlreadyRevealed |
| 16 | CommitmentMismatch |
| 17 | NotCommitted |
| 18 | NoBidsRevealed |
| 19 | AlreadyPaused |
| 20 | NotPaused |
| 21 | DisputeFailed |
| 22 | ReputationCallFailed |
| 23 | ContractNotInitialized |
| 24 | UnauthorizedGroup |

### Reputation Errors

| Code | Name |
|------|------|
| 1 | NotAdmin |
| 2 | NotAuthorizedGroup |
| 3 | AlreadyInitialized |

### Identity Errors

| Code | Name |
|------|------|
| 1 | NotAdmin |
| 2 | SelfAttestation |
| 3 | DuplicateAttestation |
| 4 | ContractNotInitialized |
| 5 | ReputationNotSet |

### Dispute Errors

| Code | Name |
|------|------|
| 1 | NotAdmin |
| 2 | NotArbitrator |
| 3 | AlreadyVoted |
| 4 | DisputeNotFound |
| 5 | TooFewArbitrators |
| 6 | AlreadyResolved |
| 7 | AlreadyInitialized |
| 8 | Unauthorized |
| 9 | InvalidRequiredVotes |
