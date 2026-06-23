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
