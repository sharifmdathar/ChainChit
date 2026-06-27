#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, Map};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Reputation data for a single address. All values are cumulative across all groups.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ReputationData {
    pub address: Address,
    /// Number of individual payments made on time.
    pub on_time_payments: u32,
    /// Total number of payments that were due (cycles × groups).
    pub total_payments_due: u32,
    /// Number of cycles where the member defaulted.
    pub cycles_defaulted: u32,
    /// Number of group cycles fully completed by this member.
    pub cycles_completed: u32,
    /// Number of bids won across all groups.
    pub bids_won: u32,
    /// Number of disputes raised by this member.
    pub disputes_raised: u32,
    /// Number of disputes lost (found against this member).
    pub disputes_lost: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Map<Address, ReputationData> — the core reputation store.
    ReputationMap,
    /// Set of ChitGroup contract addresses authorized to call record_* functions.
    AuthorizedGroup(Address),
    /// Minimum payments before a member is considered "established".
    MinPaymentsForTrust,
    Factory,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    NotAdmin = 1,
    UnauthorizedCaller = 2,
    NoReputation = 3,
    AlreadyAuthorized = 4,
    NotAuthorized = 5,
    ContractNotInitialized = 6,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    /// Initialize the reputation contract with an admin.
    pub fn initialize(env: Env, admin: Address, min_payments_for_trust: u32) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::ContractNotInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ReputationMap, &Map::<Address, ReputationData>::new(&env));
        env.storage()
            .instance()
            .set(&DataKey::MinPaymentsForTrust, &min_payments_for_trust);
        Ok(())
    }

    /// Set the factory contract that is allowed to authorize groups
    pub fn set_factory(env: Env, caller: Address, factory: Address) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::ContractNotInitialized)?;
        if caller != admin {
            return Err(Error::NotAdmin);
        }
        env.storage().instance().set(&DataKey::Factory, &factory);
        Ok(())
    }

    /// Authorize a ChitGroup contract to call record_* functions.
    pub fn authorize_group(env: Env, caller: Address, group: Address) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::ContractNotInitialized)?;
            
        let factory: Option<Address> = env.storage().instance().get(&DataKey::Factory);
        
        if caller != admin && Some(caller.clone()) != factory {
            return Err(Error::NotAdmin);
        }
        if env
            .storage()
            .instance()
            .has(&DataKey::AuthorizedGroup(group.clone()))
        {
            return Err(Error::AlreadyAuthorized);
        }
        env.storage()
            .instance()
            .set(&DataKey::AuthorizedGroup(group), &true);
        Ok(())
    }

    /// Revoke a group's authorization.
    pub fn revoke_group(env: Env, caller: Address, group: Address) -> Result<(), Error> {
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
            .remove(&DataKey::AuthorizedGroup(group));
        Ok(())
    }

    /// Record a payment. Called by authorized ChitGroup contracts.
    pub fn record_payment(
        env: Env,
        caller: Address,
        member: Address,
        on_time: bool,
    ) -> Result<(), Error> {
        Self::ensure_authorized(&env, &caller)?;

        let mut map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let mut data = map.get(member.clone()).unwrap_or_else(|| ReputationData {
            address: member.clone(),
            on_time_payments: 0,
            total_payments_due: 0,
            cycles_defaulted: 0,
            cycles_completed: 0,
            bids_won: 0,
            disputes_raised: 0,
            disputes_lost: 0,
        });

        data.total_payments_due = data.total_payments_due.saturating_add(1);
        if on_time {
            data.on_time_payments = data.on_time_payments.saturating_add(1);
        }

        map.set(member, data);
        env.storage()
            .instance()
            .set(&DataKey::ReputationMap, &map);
        Ok(())
    }

    /// Record a default for a member.
    pub fn record_default(env: Env, caller: Address, member: Address) -> Result<(), Error> {
        Self::ensure_authorized(&env, &caller)?;

        let mut map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let mut data = map.get(member.clone()).unwrap_or_else(|| ReputationData {
            address: member.clone(),
            on_time_payments: 0,
            total_payments_due: 0,
            cycles_defaulted: 0,
            cycles_completed: 0,
            bids_won: 0,
            disputes_raised: 0,
            disputes_lost: 0,
        });

        data.cycles_defaulted = data.cycles_defaulted.saturating_add(1);
        data.total_payments_due = data.total_payments_due.saturating_add(1);

        map.set(member, data);
        env.storage()
            .instance()
            .set(&DataKey::ReputationMap, &map);
        Ok(())
    }

    /// Record that a member won a bid.
    pub fn record_bid_won(env: Env, caller: Address, member: Address) -> Result<(), Error> {
        Self::ensure_authorized(&env, &caller)?;

        let mut map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let mut data = map.get(member.clone()).unwrap_or_else(|| ReputationData {
            address: member.clone(),
            on_time_payments: 0,
            total_payments_due: 0,
            cycles_defaulted: 0,
            cycles_completed: 0,
            bids_won: 0,
            disputes_raised: 0,
            disputes_lost: 0,
        });

        data.bids_won = data.bids_won.saturating_add(1);

        map.set(member, data);
        env.storage()
            .instance()
            .set(&DataKey::ReputationMap, &map);
        Ok(())
    }

    /// Record that a member completed a full cycle (all payments made).
    pub fn record_group_cycle_completed(
        env: Env,
        caller: Address,
        member: Address,
    ) -> Result<(), Error> {
        Self::ensure_authorized(&env, &caller)?;

        let mut map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let mut data = map.get(member.clone()).unwrap_or_else(|| ReputationData {
            address: member.clone(),
            on_time_payments: 0,
            total_payments_due: 0,
            cycles_defaulted: 0,
            cycles_completed: 0,
            bids_won: 0,
            disputes_raised: 0,
            disputes_lost: 0,
        });

        data.cycles_completed = data.cycles_completed.saturating_add(1);

        map.set(member, data);
        env.storage()
            .instance()
            .set(&DataKey::ReputationMap, &map);
        Ok(())
    }

    /// Record dispute outcome. Can be called by any authorized group or the Dispute contract.
    pub fn record_dispute_outcome(
        env: Env,
        caller: Address,
        member: Address,
        member_lost: bool,
    ) -> Result<(), Error> {
        Self::ensure_authorized(&env, &caller)?;

        let mut map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let mut data = map.get(member.clone()).unwrap_or_else(|| ReputationData {
            address: member.clone(),
            on_time_payments: 0,
            total_payments_due: 0,
            cycles_defaulted: 0,
            cycles_completed: 0,
            bids_won: 0,
            disputes_raised: 0,
            disputes_lost: 0,
        });

        data.disputes_raised = data.disputes_raised.saturating_add(1);
        if member_lost {
            data.disputes_lost = data.disputes_lost.saturating_add(1);
        }

        map.set(member, data);
        env.storage()
            .instance()
            .set(&DataKey::ReputationMap, &map);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// Get full reputation data for an address.
    pub fn get_reputation(env: Env, member: Address) -> Result<ReputationData, Error> {
        let map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        map.get(member).ok_or(Error::NoReputation)
    }

    /// Get on-time payment ratio in basis points (0-10000).
    /// 10000 = 100% on time. Returns 0 if no payments due.
    pub fn get_on_time_ratio(env: Env, member: Address) -> u32 {
        let map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let data = match map.get(member) {
            Some(d) => d,
            None => return 0,
        };

        if data.total_payments_due == 0 {
            return 0;
        }

        // (on_time / total) * 10000 in integer math
        let on_time = data.on_time_payments as u64;
        let total = data.total_payments_due as u64;
        ((on_time * 10000) / total) as u32
    }

    /// Check if a member is "established" (has enough payment history).
    pub fn is_established(env: Env, member: Address) -> bool {
        let map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let min: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MinPaymentsForTrust)
            .unwrap_or(3);

        map.get(member)
            .map_or(false, |d| d.total_payments_due >= min)
    }

    /// Get a composite reputation score (0-1000) for quick display.
    /// Factors: on-time ratio (60%), cycles completed (20%), no disputes (10%), bids won (10%).
    pub fn get_composite_score(env: Env, member: Address) -> u32 {
        let map: Map<Address, ReputationData> = env
            .storage()
            .instance()
            .get(&DataKey::ReputationMap)
            .unwrap_or_else(|| Map::new(&env));

        let data = match map.get(member) {
            Some(d) => d,
            None => return 0,
        };

        // On-time ratio component (0-600)
        let on_time_score = if data.total_payments_due > 0 {
            let ratio = (data.on_time_payments as u64 * 10000) / data.total_payments_due as u64;
            ((ratio * 600) / 10000) as u32
        } else {
            0
        };

        // Cycles completed component (0-200), capped at 10 cycles
        let cycle_score = data.cycles_completed.min(10) as u32 * 20;

        // Dispute component (0-100): lose 100 per dispute lost, floor at 0
        let dispute_score = 100u32.saturating_sub(data.disputes_lost * 50);

        // Bids won component (0-100), capped at 5
        let bid_score = data.bids_won.min(5) as u32 * 20;

        on_time_score + cycle_score + dispute_score + bid_score
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

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
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        // New member should have no reputation
        let stranger = Address::generate(&env);
        let result = client.try_get_reputation(&stranger);
        assert!(result.is_err());
    }

    #[test]
    fn test_on_time_ratio() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let member = Address::generate(&env);

        // 3 on-time payments out of 3
        client.record_payment(&group, &member, &true);
        client.record_payment(&group, &member, &true);
        client.record_payment(&group, &member, &true);

        let ratio = client.get_on_time_ratio(&member);
        assert_eq!(ratio, 10000); // 100% in basis points
    }

    #[test]
    fn test_on_time_ratio_partial() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let member = Address::generate(&env);

        // 2 on-time, 1 late
        client.record_payment(&group, &member, &true);
        client.record_payment(&group, &member, &true);
        client.record_payment(&group, &member, &false);

        let ratio = client.get_on_time_ratio(&member);
        assert_eq!(ratio, 6666); // ~66.66%
    }

    #[test]
    fn test_composite_score() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &1_u32);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let member = Address::generate(&env);

        // Perfect record: 5 on-time payments, 5 cycles completed, 2 bids won, no disputes
        for _ in 0..5 {
            client.record_payment(&group, &member, &true);
        }
        for _ in 0..5 {
            client.record_group_cycle_completed(&group, &member);
        }
        client.record_bid_won(&group, &member);
        client.record_bid_won(&group, &member);

        let score = client.get_composite_score(&member);
        // on_time: 600, cycles: 100, disputes: 100, bids: 40 = 840
        assert_eq!(score, 840);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn test_unauthorized_record() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        let rogue = Address::generate(&env);
        let member = Address::generate(&env);

        client.record_payment(&rogue, &member, &true);
    }

    #[test]
    fn test_is_established() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let member = Address::generate(&env);

        assert!(!client.is_established(&member));

        client.record_payment(&group, &member, &true);
        client.record_payment(&group, &member, &true);
        assert!(!client.is_established(&member));

        client.record_payment(&group, &member, &true);
        assert!(client.is_established(&member));
    }

    #[test]
    fn test_default_increments_both_counters() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &1_u32);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let member = Address::generate(&env);
        client.record_default(&group, &member);

        let rep = client.try_get_reputation(&member).unwrap().unwrap();
        assert_eq!(rep.cycles_defaulted, 1);
        assert_eq!(rep.total_payments_due, 1);
        assert_eq!(rep.on_time_payments, 0);

        let ratio = client.get_on_time_ratio(&member);
        assert_eq!(ratio, 0);
    }

    #[test]
    fn test_composite_score_with_disputes() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &1_u32);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);

        let member = Address::generate(&env);
        client.record_payment(&group, &member, &true); // 100% ratio, score 600
        client.record_dispute_outcome(&group, &member, &true); // lost dispute

        let score = client.get_composite_score(&member);
        // on_time: 600, cycles: 0, disputes: 100-50=50, bids: 0 = 650
        assert_eq!(score, 650);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn test_double_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);
        client.initialize(&admin, &3_u32);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_authorize_group_non_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        let fake_admin = Address::generate(&env);
        let group = Address::generate(&env);
        client.authorize_group(&fake_admin, &group);
    }

    #[test]
    fn test_revoke_group() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        let group = Address::generate(&env);
        client.authorize_group(&admin, &group);
        client.revoke_group(&admin, &group);

        // Now group should be unauthorized
        let member = Address::generate(&env);
        let result = client.try_record_payment(&group, &member, &true);
        assert!(result.is_err());
    }

    #[test]
    fn test_stranger_zero_reputation() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let client = ReputationContractClient::new(&env, &contract_id);

        client.initialize(&admin, &3_u32);

        let stranger = Address::generate(&env);
        assert_eq!(client.get_on_time_ratio(&stranger), 0);
        assert_eq!(client.get_composite_score(&stranger), 0);
        assert!(!client.is_established(&stranger));
    }
}
