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
