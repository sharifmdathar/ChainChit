#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, Map, String, Symbol,
    Vec,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GroupState {
    Forming,
    Collecting,
    Bidding,
    Payout,
    Completed,
    Paused,
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum MemberStatus {
    Pending,
    Paid,
    Defaulted,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BidRecord {
    pub commitment: Vec<u8>,
    pub revealed: bool,
    pub amount: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CycleState {
    pub payments: Map<Address, MemberStatus>,
    pub bids: Map<Address, BidRecord>,
    pub winner: Option<Address>,
    pub winning_bid: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct GroupInfo {
    pub admin: Address,
    pub token: Address,
    pub reputation_contract: Address,
    pub identity_contract: Address,
    pub dispute_contract: Address,
    pub contribution_amount: u64,
    pub num_members: u32,
    pub total_cycles: u32,
    pub current_cycle: u32,
    pub state: GroupState,
    pub min_attestation_score: u32,
    pub min_reputation_for_bid: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    GroupInfo,
    Members,              // Vec<Address>
    Cycle(u32),           // CycleState
    MemberIndex(Address), // u32 — index in members vec
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    NotAdmin = 1,
    InvalidState = 2,
    AlreadyMember = 3,
    NotMember = 4,
    GroupFull = 5,
    InsufficientPayment = 6,
    AlreadyPaid = 7,
    AlreadyCommitted = 8,
    InvalidReveal = 9,
    BidTooLow = 10,
    NotAttested = 11,
    Paused = 12,
    Unauthorized = 13,
    NotForming = 14,
    NotCollecting = 15,
    NotBidding = 16,
    NotPayout = 17,
    NoBids = 18,
    InvalidAmount = 19,
    ContractNotRegistered = 20,
    CycleNotFound = 21,
    NotRevealed = 22,
    NoValidBids = 23,
    AlreadyCompleted = 24,
    ReputationTooLow = 25,
    AlreadyRevealed = 26,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct ChitGroupContract;

#[contractimpl]
impl ChitGroupContract {
    /// Initialize a new chit group. The admin becomes the first member.
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        reputation_contract: Address,
        identity_contract: Address,
        dispute_contract: Address,
        contribution_amount: u64,
        num_members: u32,
        total_cycles: u32,
        min_attestation_score: u32,
        min_reputation_for_bid: u32,
    ) -> Result<(), Error> {
        admin.require_auth();

        if contribution_amount == 0 {
            return Err(Error::InvalidAmount);
        }
        if num_members < 2 {
            return Err(Error::InvalidAmount);
        }
        if total_cycles < 2 {
            return Err(Error::InvalidAmount);
        }

        // Ensure no prior initialization
        if env.storage().instance().has(&DataKey::GroupInfo) {
            return Err(Error::ContractNotRegistered);
        }

        let info = GroupInfo {
            admin: admin.clone(),
            token,
            reputation_contract: reputation_contract.clone(),
            identity_contract: identity_contract.clone(),
            dispute_contract,
            contribution_amount,
            num_members,
            total_cycles,
            current_cycle: 0,
            state: GroupState::Forming,
            min_attestation_score,
            min_reputation_for_bid,
        };

        env.storage().instance().set(&DataKey::GroupInfo, &info);

        let members: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::Members, &members);

        Ok(())
    }

    /// Join a group that is in the Forming state.
    /// Caller must be attested in the Identity contract above the minimum threshold.
    pub fn join_group(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        if info.state != GroupState::Forming {
            return Err(Error::NotForming);
        }

        let mut members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(Error::ContractNotRegistered)?;

        // Check not already a member
        for i in 0..members.len() {
            if members.get(i).unwrap() == caller {
                return Err(Error::AlreadyMember);
            }
        }

        // Check group not full
        if members.len() >= info.num_members {
            return Err(Error::GroupFull);
        }

        // Check attestation via Identity contract
        let att_score = Self::check_attestation(&env, &info.identity_contract, &caller)?;
        if att_score < info.min_attestation_score {
            return Err(Error::NotAttested);
        }

        // Add member
        let idx = members.len();
        members.push_back(caller.clone());
        env.storage().instance().set(&DataKey::Members, &members);
        env.storage()
            .instance()
            .set(&DataKey::MemberIndex(caller.clone()), &idx);

        Ok(())
    }

    /// Admin transitions the group from Forming to Collecting (cycle 1).
    pub fn start_collection(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        if caller != info.admin {
            return Err(Error::NotAdmin);
        }
        if info.state != GroupState::Forming {
            return Err(Error::NotForming);
        }

        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(Error::ContractNotRegistered)?;

        if members.len() < info.num_members {
            return Err(Error::GroupFull); // repurposed: group not yet full
        }

        info.current_cycle = 1;
        info.state = GroupState::Collecting;
        env.storage().instance().set(&DataKey::GroupInfo, &info);

        // Initialize cycle state
        let cycle = CycleState {
            payments: Map::new(&env),
            bids: Map::new(&env),
            winner: None,
            winning_bid: 0,
        };
        env.storage()
            .instance()
            .set(&DataKey::Cycle(1), &cycle);

        Ok(())
    }

    /// A member pays their contribution for the current cycle.
    /// Transfers USDC from caller to this contract.
    /// Atomically updates Reputation contract.
    pub fn pay_contribution(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        if info.state != GroupState::Collecting {
            return Err(Error::NotCollecting);
        }

        // Verify caller is a member
        Self::ensure_member(&env, &caller)?;

        let cycle_key = DataKey::Cycle(info.current_cycle);
        let mut cycle: CycleState = env
            .storage()
            .instance()
            .get(&cycle_key)
            .ok_or(Error::CycleNotFound)?;

        if let Some(status) = cycle.payments.get(caller.clone()) {
            match status {
                MemberStatus::Paid => return Err(Error::AlreadyPaid),
                _ => {}
            }
        }

        // Transfer USDC: caller → this contract
        Self::transfer_token(
            &env,
            &info.token,
            &caller,
            &env.current_contract_address(),
            info.contribution_amount,
        )?;

        // Mark as paid
        cycle.payments.set(caller.clone(), MemberStatus::Paid);
        env.storage().instance().set(&cycle_key, &cycle);

        // Cross-contract: update reputation (on-time payment)
        Self::call_reputation_record_payment(
            &env,
            &info.reputation_contract,
            &caller,
            true,
        );

        // Check if all members have paid — auto-transition to Bidding
        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(Error::ContractNotRegistered)?;

        let mut all_paid = true;
        for i in 0..members.len() {
            let m = members.get(i).unwrap();
            let paid = cycle
                .payments
                .get(m.clone())
                .map_or(false, |s| s == MemberStatus::Paid);
            if !paid {
                all_paid = false;
                break;
            }
        }

        if all_paid {
            let mut info_mut: GroupInfo = env
                .storage()
                .instance()
                .get(&DataKey::GroupInfo)
                .ok_or(Error::ContractNotRegistered)?;
            info_mut.state = GroupState::Bidding;
            env.storage().instance().set(&DataKey::GroupInfo, &info_mut);
        }

        Ok(())
    }

    /// Advance to the next cycle or complete the group.
    pub fn advance_cycle(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        if caller != info.admin {
            return Err(Error::NotAdmin);
        }
        if info.state != GroupState::Payout {
            return Err(Error::NotPayout);
        }

        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(Error::ContractNotRegistered)?;

        let cycle_key = DataKey::Cycle(info.current_cycle);
        let cycle: CycleState = env
            .storage()
            .instance()
            .get(&cycle_key)
            .ok_or(Error::CycleNotFound)?;

        // Record cycle completion for all paying members, default for non-payers
        for i in 0..members.len() {
            let m = members.get(i).unwrap();
            let status = cycle.payments.get(m.clone()).unwrap_or(MemberStatus::Pending);
            match status {
                MemberStatus::Paid => {
                    Self::call_reputation_record_cycle_completed(
                        &env,
                        &info.reputation_contract,
                        &m,
                    );
                }
                _ => {
                    Self::call_reputation_record_default(
                        &env,
                        &info.reputation_contract,
                        &m,
                    );
                }
            }
        }

        if info.current_cycle >= info.total_cycles {
            info.state = GroupState::Completed;
            env.storage().instance().set(&DataKey::GroupInfo, &info);
            return Ok(());
        }

        // Advance to next cycle
        info.current_cycle += 1;
        info.state = GroupState::Collecting;
        env.storage().instance().set(&DataKey::GroupInfo, &info);

        // Initialize new cycle state
        let new_cycle = CycleState {
            payments: Map::new(&env),
            bids: Map::new(&env),
            winner: None,
            winning_bid: 0,
        };
        env.storage()
            .instance()
            .set(&DataKey::Cycle(info.current_cycle), &new_cycle);

        Ok(())
    }

    /// Commit a bid hash during the Bidding phase.
    /// commitment = sha256(bid_amount_le_bytes || nonce_le_bytes)
    pub fn commit_bid(env: Env, caller: Address, commitment: Vec<u8>) -> Result<(), Error> {
        caller.require_auth();

        let info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        if info.state != GroupState::Bidding {
            return Err(Error::NotBidding);
        }

        Self::ensure_member(&env, &caller)?;

        // Reputation gate: check on-time ratio
        let ratio = Self::get_reputation_ratio(&env, &info.reputation_contract, &caller);
        if ratio < info.min_reputation_for_bid {
            return Err(Error::ReputationTooLow);
        }

        let cycle_key = DataKey::Cycle(info.current_cycle);
        let mut cycle: CycleState = env
            .storage()
            .instance()
            .get(&cycle_key)
            .ok_or(Error::CycleNotFound)?;

        if cycle.bids.get(caller.clone()).is_some() {
            return Err(Error::AlreadyCommitted);
        }

        if commitment.len() != 32 {
            return Err(Error::InvalidReveal);
        }

        let bid = BidRecord {
            commitment,
            revealed: false,
            amount: 0,
        };
        cycle.bids.set(caller, bid);
        env.storage().instance().set(&cycle_key, &cycle);

        Ok(())
    }

    /// Reveal a previously committed bid.
    pub fn reveal_bid(
        env: Env,
        caller: Address,
        amount: u64,
        nonce: u64,
    ) -> Result<(), Error> {
        caller.require_auth();

        let info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        if info.state != GroupState::Bidding {
            return Err(Error::NotBidding);
        }

        let cycle_key = DataKey::Cycle(info.current_cycle);
        let mut cycle: CycleState = env
            .storage()
            .instance()
            .get(&cycle_key)
            .ok_or(Error::CycleNotFound)?;

        let mut bid: BidRecord = cycle
            .bids
            .get(caller.clone())
            .ok_or(Error::ContractNotRegistered)?;

        if bid.revealed {
            return Err(Error::AlreadyRevealed);
        }

        // Verify commitment = sha256(amount_le || nonce_le)
        let expected = Self::compute_commitment(&env, amount, nonce);
        if expected != bid.commitment {
            return Err(Error::InvalidReveal);
        }

        // Bid amount must be > 0 and <= contribution_amount (the "discount" the winner accepts)
        if amount == 0 || amount > info.contribution_amount {
            return Err(Error::BidTooLow);
        }

        bid.revealed = true;
        bid.amount = amount;
        cycle.bids.set(caller, bid);
        env.storage().instance().set(&cycle_key, &cycle);

        Ok(())
    }

    /// Anyone can call this after the bidding phase to execute the payout.
    /// Finds the lowest unique bid among revealed bids.
    /// Transfers the full pool (contribution_amount * num_members) to the winner.
    pub fn execute_payout(env: Env) -> Result<(), Error> {
        let mut info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        if info.state != GroupState::Bidding {
            return Err(Error::NotBidding);
        }

        let cycle_key = DataKey::Cycle(info.current_cycle);
        let mut cycle: CycleState = env
            .storage()
            .instance()
            .get(&cycle_key)
            .ok_or(Error::CycleNotFound)?;

        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(Error::ContractNotRegistered)?;

        // Collect all revealed bid amounts and find lowest unique
        let mut bid_amounts: Map<u64, u32> = Map::new(&env); // amount -> count
        let mut bidder_for_amount: Map<u64, Address> = Map::new(&env);

        for i in 0..members.len() {
            let m = members.get(i).unwrap();
            if let Some(bid) = cycle.bids.get(m.clone()) {
                if bid.revealed && bid.amount > 0 {
                    let count = bid_amounts.get(bid.amount).unwrap_or(0) + 1;
                    bid_amounts.set(bid.amount, count);
                    bidder_for_amount.set(bid.amount, m.clone());
                }
            }
        }

        // Find lowest amount with count == 1
        let mut winner: Option<Address> = None;
        let mut winning_bid: u64 = u64::MAX;

        let amounts: Vec<u64> = bid_amounts.keys();
        for i in 0..amounts.len() {
            let amt = amounts.get(i).unwrap();
            let cnt = bid_amounts.get(amt).unwrap_or(0);
            if cnt == 1 && amt < winning_bid {
                winning_bid = amt;
                winner = bidder_for_amount.get(amt);
            }
        }

        let winner_addr = winner.ok_or(Error::NoValidBids)?;

        // Payout: transfer pool to winner
        let pool_size = (info.contribution_amount as u128)
            .checked_mul(info.num_members as u128)
            .ok_or(Error::InvalidAmount)? as u64;

        Self::transfer_token(
            &env,
            &info.token,
            &env.current_contract_address(),
            &winner_addr,
            pool_size,
        )?;

        cycle.winner = Some(winner_addr.clone());
        cycle.winning_bid = winning_bid;
        env.storage().instance().set(&cycle_key, &cycle);

        // Update reputation: record bid won
        Self::call_reputation_record_bid_won(
            &env,
            &info.reputation_contract,
            &winner_addr,
        );

        // Transition to Payout state
        info.state = GroupState::Payout;
        env.storage().instance().set(&DataKey::GroupInfo, &info);

        Ok(())
    }

    /// Raise a dispute — routes to the Dispute contract.
    pub fn raise_dispute(env: Env, caller: Address, reason: String) -> Result<(), Error> {
        caller.require_auth();

        let info: GroupInfo = env
            .storage()
            .instance()
            .get(&DataKey::GroupInfo)
            .ok_or(Error::ContractNotRegistered)?;

        Self::ensure_member(&env, &caller)?;

        if info.state == GroupState::Completed {
            return Err(Error::AlreadyCompleted);
        }

        // Cross-contract call to Dispute contract
        let args = soroban_sdk::vec![
            &env,
            caller.to_val(),
            (info.current_cycle as u64).to_val(),
            reason.to_val(),
        ];
        env.invoke_contract(
            &info.dispute_contract,
            &Symbol::short("raise_dispute"),
            &args,
        );

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Internal helpers (storage access patterns)
    // -----------------------------------------------------------------------

    fn ensure_member(env: &Env, caller: &Address) -> Result<(), Error> {
        let members: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Members)
            .ok_or(Error::ContractNotRegistered)?;

        for i in 0..members.len() {
            if members.get(i).unwrap() == *caller {
                return Ok(());
            }
        }
        Err(Error::NotMember)
    }

    fn transfer_token(
        env: &Env,
        token: &Address,
        from: &Address,
        to: &Address,
        amount: u64,
    ) -> Result<(), Error> {
        if amount == 0 {
            return Err(Error::InvalidAmount);
        }
        let args = soroban_sdk::vec![
            env,
            from.to_val(),
            to.to_val(),
            (amount as i128).to_val(),
        ];
        env.invoke_contract(token, &Symbol::short("transfer"), &args);
        Ok(())
    }

    fn check_attestation(env: &Env, identity_contract: &Address, caller: &Address) -> Result<u32, Error> {
        let args = soroban_sdk::vec![env, caller.to_val()];
        let result = env.invoke_contract(
            identity_contract,
            &Symbol::short("get_attestation_score"),
            &args,
        );
        let score: u32 = result.try_into().unwrap_or(0);
        Ok(score)
    }

    fn get_reputation_ratio(env: &Env, reputation_contract: &Address, caller: &Address) -> u32 {
        let args = soroban_sdk::vec![env, caller.to_val()];
        let result = env.invoke_contract(
            reputation_contract,
            &Symbol::short("get_on_time_ratio"),
            &args,
        );
        result.try_into().unwrap_or(0)
    }

    fn call_reputation_record_payment(
        env: &Env,
        reputation_contract: &Address,
        caller: &Address,
        on_time: bool,
    ) {
        let args = soroban_sdk::vec![
            env,
            caller.to_val(),
            on_time.to_val(),
        ];
        env.invoke_contract(
            reputation_contract,
            &Symbol::short("record_payment"),
            &args,
        );
    }

    fn call_reputation_record_default(
        env: &Env,
        reputation_contract: &Address,
        caller: &Address,
    ) {
        let args = soroban_sdk::vec![env, caller.to_val()];
        env.invoke_contract(
            reputation_contract,
            &Symbol::short("record_default"),
            &args,
        );
    }

    fn call_reputation_record_bid_won(
        env: &Env,
        reputation_contract: &Address,
        caller: &Address,
    ) {
        let args = soroban_sdk::vec![env, caller.to_val()];
        env.invoke_contract(
            reputation_contract,
            &Symbol::short("record_bid_won"),
            &args,
        );
    }

    fn call_reputation_record_cycle_completed(
        env: &Env,
        reputation_contract: &Address,
        caller: &Address,
    ) {
        let args = soroban_sdk::vec![env, caller.to_val()];
        env.invoke_contract(
            reputation_contract,
            &Symbol::short("record_group_cycle_completed"),
            &args,
        );
    }

    fn compute_commitment(env: &Env, amount: u64, nonce: u64) -> Vec<u8> {
        let mut data = Vec::new(env);
        data.push_back((amount >> 0) as u8);
        data.push_back((amount >> 8) as u8);
        data.push_back((amount >> 16) as u8);
        data.push_back((amount >> 24) as u8);
        data.push_back((amount >> 32) as u8);
        data.push_back((amount >> 40) as u8);
        data.push_back((amount >> 48) as u8);
        data.push_back((amount >> 56) as u8);
        data.push_back((nonce >> 0) as u8);
        data.push_back((nonce >> 8) as u8);
        data.push_back((nonce >> 16) as u8);
        data.push_back((nonce >> 24) as u8);
        data.push_back((nonce >> 32) as u8);
        data.push_back((nonce >> 40) as u8);
        data.push_back((nonce >> 48) as u8);
        data.push_back((nonce >> 56) as u8);
        env.crypto().sha256(&data).to_bytes()
    }
}
