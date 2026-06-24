#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, Map, String, Symbol, Vec};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeStatus {
    Open,
    Voting,
    Resolved,
    Dismissed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeDecision {
    Dismiss,
    ReversePayout,
    ForceDefault,
    PartialRefund,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DisputeRecord {
    pub id: u64,
    pub raiser: Address,
    pub cycle: u64,
    pub reason: String,
    pub status: DisputeStatus,
    pub votes_for: Vec<Address>,
    pub votes_against: Vec<Address>,
    pub decision: Option<DisputeDecision>,
    pub resolved_at: Option<u64>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Auto-incrementing dispute ID counter.
    NextDisputeId,
    /// Individual dispute by ID.
    Dispute(u64),
    /// List of arbitrator addresses.
    Arbitrators,
    /// Number of votes required for resolution (e.g., 3 for 5 arbitrators).
    RequiredVotes,
    /// Reputation contract address.
    ReputationContract,
    /// Set of authorized callers (ChitGroup contracts).
    AuthorizedGroup(Address),
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    NotAdmin = 1,
    NotArbitrator = 2,
    AlreadyVoted = 3,
    DisputeNotFound = 4,
    DisputeNotOpen = 5,
    AlreadyResolved = 6,
    ContractNotInitialized = 7,
    UnauthorizedCaller = 8,
    InvalidDecision = 9,
    NotEnoughArbitrators = 10,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct DisputeContract;

#[contractimpl]
impl DisputeContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        arbitrators: Vec<Address>,
        required_votes: u32,
        reputation_contract: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::ContractNotInitialized);
        }
        admin.require_auth();

        if arbitrators.len() < 3 {
            return Err(Error::NotEnoughArbitrators);
        }
        if required_votes < 2 || required_votes as u32 > arbitrators.len() {
            return Err(Error::InvalidDecision);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextDisputeId, &1_u64);
        env.storage().instance().set(&DataKey::Arbitrators, &arbitrators);
        env.storage()
            .instance()
            .set(&DataKey::RequiredVotes, &required_votes);
        env.storage()
            .instance()
            .set(&DataKey::ReputationContract, &reputation_contract);
        Ok(())
    }

    /// Authorize a ChitGroup contract to raise disputes.
    pub fn authorize_group(env: Env, caller: Address, group: Address) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::ContractNotInitialized)?;
        if caller != admin {
            return Err(Error::NotAdmin);
        }
        env.storage()
            .instance()
            .set(&DataKey::AuthorizedGroup(group), &true);
        Ok(())
    }

    /// Raise a dispute. Called by authorized ChitGroup contracts on behalf of a member.
    pub fn raise_dispute(
        env: Env,
        caller: Address,
        raiser: Address,
        cycle: u64,
        reason: String,
    ) -> Result<u64, Error> {
        Self::ensure_authorized(&env, &caller)?;

        let dispute_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextDisputeId)
            .unwrap_or(1);

        let dispute = DisputeRecord {
            id: dispute_id,
            raiser,
            cycle,
            reason,
            status: DisputeStatus::Open,
            votes_for: Vec::new(&env),
            votes_against: Vec::new(&env),
            decision: None,
            resolved_at: None,
        };

        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id), &dispute);
        env.storage()
            .instance()
            .set(&DataKey::NextDisputeId, &(dispute_id + 1));

        Ok(dispute_id)
    }

    /// An arbitrator casts a vote on an open dispute.
    pub fn cast_vote(
        env: Env,
        arbitrator: Address,
        dispute_id: u64,
        in_favor: bool,
        decision: DisputeDecision,
    ) -> Result<(), Error> {
        arbitrator.require_auth();

        Self::ensure_arbitrator(&env, &arbitrator)?;

        let mut dispute: DisputeRecord = env
            .storage()
            .instance()
            .get(&DataKey::Dispute(dispute_id))
            .ok_or(Error::DisputeNotFound)?;

        if dispute.status != DisputeStatus::Open && dispute.status != DisputeStatus::Voting {
            return Err(Error::DisputeNotOpen);
        }

        // Check not already voted
        for i in 0..dispute.votes_for.len() {
            if dispute.votes_for.get(i).unwrap() == arbitrator {
                return Err(Error::AlreadyVoted);
            }
        }
        for i in 0..dispute.votes_against.len() {
            if dispute.votes_against.get(i).unwrap() == arbitrator {
                return Err(Error::AlreadyVoted);
            }
        }

        dispute.status = DisputeStatus::Voting;

        if in_favor {
            dispute.votes_for.push_back(arbitrator);
            dispute.decision = Some(decision);
        } else {
            dispute.votes_against.push_back(arbitrator);
        }

        // Check if threshold reached
        let required: u32 = env
            .storage()
            .instance()
            .get(&DataKey::RequiredVotes)
            .unwrap_or(3);

        if dispute.votes_for.len() >= required {
            dispute.status = DisputeStatus::Resolved;
            dispute.resolved_at = Some(env.ledger().timestamp());
            // Record outcome in reputation
            Self::record_dispute_outcome(&env, &dispute);
        } else if dispute.votes_against.len() >= required {
            dispute.status = DisputeStatus::Dismissed;
            dispute.resolved_at = Some(env.ledger().timestamp());
            dispute.decision = Some(DisputeDecision::Dismiss);
        }

        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id), &dispute);

        Ok(())
    }

    /// Admin can manually resolve a dispute (emergency override).
    pub fn resolve_dispute(
        env: Env,
        caller: Address,
        dispute_id: u64,
        decision: DisputeDecision,
    ) -> Result<(), Error> {
        caller.require_auth();

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::ContractNotInitialized)?;
        if caller != admin {
            return Err(Error::NotAdmin);
        }

        let mut dispute: DisputeRecord = env
            .storage()
            .instance()
            .get(&DataKey::Dispute(dispute_id))
            .ok_or(Error::DisputeNotFound)?;

        if dispute.status == DisputeStatus::Resolved || dispute.status == DisputeStatus::Dismissed {
            return Err(Error::AlreadyResolved);
        }

        dispute.status = DisputeStatus::Resolved;
        dispute.decision = Some(decision);
        dispute.resolved_at = Some(env.ledger().timestamp());

        Self::record_dispute_outcome(&env, &dispute);

        env.storage()
            .instance()
            .set(&DataKey::Dispute(dispute_id), &dispute);

        Ok(())
    }

    /// Get a dispute by ID.
    pub fn get_dispute(env: Env, dispute_id: u64) -> Result<DisputeRecord, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Dispute(dispute_id))
            .ok_or(Error::DisputeNotFound)
    }

    /// Get all arbitrator addresses.
    pub fn get_arbitrators(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Arbitrators)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Admin can add an arbitrator.
    pub fn add_arbitrator(env: Env, caller: Address, arbitrator: Address) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::ContractNotInitialized)?;
        if caller != admin {
            return Err(Error::NotAdmin);
        }

        let mut arbitrators: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Arbitrators)
            .unwrap_or_else(|| Vec::new(&env));

        // Check not duplicate
        for i in 0..arbitrators.len() {
            if arbitrators.get(i).unwrap() == arbitrator {
                return Ok(());
            }
        }

        arbitrators.push_back(arbitrator);
        env.storage().instance().set(&DataKey::Arbitrators, &arbitrators);
        Ok(())
    }

    /// Admin can remove an arbitrator.
    pub fn remove_arbitrator(env: Env, caller: Address, arbitrator: Address) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::ContractNotInitialized)?;
        if caller != admin {
            return Err(Error::NotAdmin);
        }

        let arbitrators: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Arbitrators)
            .unwrap_or_else(|| Vec::new(&env));

        let mut updated: Vec<Address> = Vec::new(&env);
        for i in 0..arbitrators.len() {
            let a = arbitrators.get(i).unwrap();
            if a != arbitrator {
                updated.push_back(a.clone());
            }
        }
        env.storage().instance().set(&DataKey::Arbitrators, &updated);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    fn ensure_arbitrator(env: &Env, address: &Address) -> Result<(), Error> {
        let arbitrators: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Arbitrators)
            .unwrap_or_else(|| Vec::new(&env));

        for i in 0..arbitrators.len() {
            if arbitrators.get(i).unwrap() == *address {
                return Ok(());
            }
        }
        Err(Error::NotArbitrator)
    }

    fn ensure_authorized(env: &Env, caller: &Address) -> Result<(), Error> {
        if env
            .storage()
            .instance()
            .has(&DataKey::AuthorizedGroup(caller.clone()))
        {
            Ok(())
        } else {
            Err(Error::UnauthorizedCaller)
        }
    }

    fn record_dispute_outcome(env: &Env, dispute: &DisputeRecord) {
        let reputation_addr: Address = match env
            .storage()
            .instance()
            .get(&DataKey::ReputationContract)
        {
            Some(a) => a,
            None => return,
        };

        let member_lost = match dispute.decision {
            Some(DisputeDecision::Dismiss) => false,
            Some(DisputeDecision::ReversePayout) => true,
            Some(DisputeDecision::ForceDefault) => true,
            Some(DisputeDecision::PartialRefund) => true,
            None => false,
        };

        let args = soroban_sdk::vec![
            env,
            dispute.raiser.to_val(),
            member_lost.to_val(),
        ];
        env.invoke_contract(
            &reputation_addr,
            &Symbol::short("record_dispute_outcome"),
            &args,
        );
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn make_arbitrators(env: &Env, count: u32) -> Vec<Address> {
        let mut v = Vec::new(env);
        for _ in 0..count {
            v.push_back(Address::generate(env));
        }
        v
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let fetched = client.get_arbitrators();
        assert_eq!(fetched.len(), 5);
    }

    #[test]
    #[should_panic(expected = "Error(NotEnoughArbitrators)")]
    fn test_initialize_too_few_arbitrators() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 2);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &2_u32, &reputation);
    }

    #[test]
    fn test_raise_dispute() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "Member did not pay");

        let id = client.raise_dispute(&group, &raiser, &1_u64, &reason);
        assert_eq!(id, 1);

        let dispute = client.get_dispute(&id);
        assert_eq!(dispute.status, DisputeStatus::Open);
        assert_eq!(dispute.raiser, raiser);
    }

    #[test]
    fn test_auto_increment_dispute_id() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");

        let id1 = client.raise_dispute(&group, &raiser, &1_u64, &reason);
        let id2 = client.raise_dispute(&group, &raiser, &2_u64, &reason);
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
    }

    #[test]
    #[should_panic(expected = "Error(NotArbitrator)")]
    fn test_non_arbitrator_cannot_vote() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");
        let id = client.raise_dispute(&group, &raiser, &1_u64, &reason);

        let non_arb = Address::generate(&env);
        client.cast_vote(&non_arb, &id, &true, &DisputeDecision::Dismiss);
    }

    #[test]
    fn test_dispute_resolves_on_threshold() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");
        let id = client.raise_dispute(&group, &raiser, &1_u64, &reason);

        // 3 arbitrators vote in favor
        let arb1 = arbitrators.get(0).unwrap();
        let arb2 = arbitrators.get(1).unwrap();
        let arb3 = arbitrators.get(2).unwrap();

        client.cast_vote(&arb1, &id, &true, &DisputeDecision::ForceDefault);
        let d = client.get_dispute(&id);
        assert_eq!(d.status, DisputeStatus::Voting);

        client.cast_vote(&arb2, &id, &true, &DisputeDecision::ForceDefault);
        let d = client.get_dispute(&id);
        assert_eq!(d.status, DisputeStatus::Voting);

        client.cast_vote(&arb3, &id, &true, &DisputeDecision::ForceDefault);
        let d = client.get_dispute(&id);
        assert_eq!(d.status, DisputeStatus::Resolved);
        assert_eq!(d.decision, Some(DisputeDecision::ForceDefault));
    }

    #[test]
    fn test_dispute_dismissed_on_counter_votes() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");
        let id = client.raise_dispute(&group, &raiser, &1_u64, &reason);

        // 3 arbitrators vote against
        let arb1 = arbitrators.get(0).unwrap();
        let arb2 = arbitrators.get(1).unwrap();
        let arb3 = arbitrators.get(2).unwrap();

        client.cast_vote(&arb1, &id, &false, &DisputeDecision::Dismiss);
        client.cast_vote(&arb2, &id, &false, &DisputeDecision::Dismiss);
        client.cast_vote(&arb3, &id, &false, &DisputeDecision::Dismiss);

        let d = client.get_dispute(&id);
        assert_eq!(d.status, DisputeStatus::Dismissed);
    }

    #[test]
    #[should_panic(expected = "Error(AlreadyVoted)")]
    fn test_double_vote_rejected() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");
        let id = client.raise_dispute(&group, &raiser, &1_u64, &reason);

        let arb = arbitrators.get(0).unwrap();
        client.cast_vote(&arb, &id, &true, &DisputeDecision::ForceDefault);
        // Same arbitrator tries to vote again
        client.cast_vote(&arb, &id, &true, &DisputeDecision::ForceDefault);
    }

    // ------------------- Admin resolution tests -------------------

    #[test]
    fn test_admin_resolve_dispute() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");
        let id = client.raise_dispute(&group, &raiser, &1_u64, &reason);

        client.resolve_dispute(&admin, &id, &DisputeDecision::ReversePayout);

        let d = client.get_dispute(&id);
        assert_eq!(d.status, DisputeStatus::Resolved);
        assert_eq!(d.decision, Some(DisputeDecision::ReversePayout));
    }

    #[test]
    #[should_panic(expected = "Error(AlreadyResolved)")]
    fn test_resolve_already_resolved() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");
        let id = client.raise_dispute(&group, &raiser, &1_u64, &reason);

        // Resolve once
        client.resolve_dispute(&admin, &id, &DisputeDecision::ForceDefault);
        // Try to resolve again — should fail
        client.resolve_dispute(&admin, &id, &DisputeDecision::Dismiss);
    }

    // ------------------- Arbitrator management tests -------------------

    #[test]
    fn test_add_arbitrator() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 3);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &2_u32, &reputation);

        let new_arb = Address::generate(&env);
        client.add_arbitrator(&admin, &new_arb);

        let fetched = client.get_arbitrators();
        assert_eq!(fetched.len(), 4);
    }

    #[test]
    fn test_add_duplicate_arbitrator_ignored() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 3);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &2_u32, &reputation);

        let existing = arbitrators.get(0).unwrap();
        client.add_arbitrator(&admin, &existing);

        let fetched = client.get_arbitrators();
        assert_eq!(fetched.len(), 3); // no duplicate added
    }

    #[test]
    fn test_remove_arbitrator() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let to_remove = arbitrators.get(0).unwrap();
        client.remove_arbitrator(&admin, &to_remove);

        let fetched = client.get_arbitrators();
        assert_eq!(fetched.len(), 4);
    }

    #[test]
    #[should_panic(expected = "Error(NotAdmin)")]
    fn test_add_arbitrator_non_admin() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        let stranger = Address::generate(&env);
        let new_arb = Address::generate(&env);
        client.add_arbitrator(&stranger, &new_arb);
    }

    // ------------------- Unauthorized raise dispute -------------------

    #[test]
    #[should_panic(expected = "Error(UnauthorizedCaller)")]
    fn test_unauthorized_raise_dispute() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        // Not authorized
        let rogue = Address::generate(&env);
        let raiser = Address::generate(&env);
        let reason = String::from_str(&env, "test");
        client.raise_dispute(&rogue, &raiser, &1_u64, &reason);
    }

    // ------------------- Invalid required_votes -------------------

    #[test]
    #[should_panic(expected = "Error(InvalidDecision)")]
    fn test_initialize_required_votes_too_low() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        // required_votes = 1 is below minimum of 2
        client.initialize(&admin, &arbitrators, &1_u32, &reputation);
    }

    #[test]
    #[should_panic(expected = "Error(InvalidDecision)")]
    fn test_initialize_required_votes_exceeds_arbitrators() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 3);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        // required_votes = 4 but only 3 arbitrators
        client.initialize(&admin, &arbitrators, &4_u32, &reputation);
    }

    #[test]
    #[should_panic(expected = "Error(DisputeNotFound)")]
    fn test_get_nonexistent_dispute() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let arbitrators = make_arbitrators(&env, 5);
        let reputation = Address::generate(&env);
        let contract_id = env.register(DisputeContract, ());
        let client = DisputeContractClient::new(&env, &contract_id);

        client.initialize(&admin, &arbitrators, &3_u32, &reputation);

        // No disputes raised yet
        client.get_dispute(&999_u64);
    }
}
