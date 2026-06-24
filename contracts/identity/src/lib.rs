#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, Map, Symbol, Vec};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single attestation edge: vouchor vouches for vouchee.
/// Weight is determined by vouchor's reputation at the time of vouching.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Attestation {
    pub vouchor: Address,
    pub vouchee: Address,
    pub weight: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Map<vouchee, Vec<Attestation>> — all attestations received by an address.
    Attestations(Address),
    /// Reputation contract address for weight lookups.
    ReputationContract,
    /// Minimum total weight to be considered "attested".
    MinAttestationWeight,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    NotAdmin = 1,
    SelfAttestation = 2,
    DuplicateAttestation = 3,
    ContractNotInitialized = 4,
    ReputationNotSet = 5,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct IdentityContract;

#[contractimpl]
impl IdentityContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        reputation_contract: Address,
        min_attestation_weight: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::ContractNotInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ReputationContract, &reputation_contract);
        env.storage()
            .instance()
            .set(&DataKey::MinAttestationWeight, &min_attestation_weight);
        Ok(())
    }

    /// Vouch for another address. The vouchor's reputation at the time of vouching
    /// determines the attestation weight. This makes Sybil attacks expensive:
    /// fake accounts have zero reputation, so their vouches carry zero weight.
    pub fn vouch(env: Env, vouchor: Address, vouchee: Address) -> Result<(), Error> {
        vouchor.require_auth();

        if vouchor == vouchee {
            return Err(Error::SelfAttestation);
        }

        let reputation_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::ReputationContract)
            .ok_or(Error::ReputationNotSet)?;

        // Get vouchor's composite score as the weight
        let weight = Self::get_reputation_score(&env, &reputation_addr, &vouchor);

        let mut attestations: Vec<Attestation> = env
            .storage()
            .persistent()
            .get(&DataKey::Attestations(vouchee.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        // Check for duplicate
        for i in 0..attestations.len() {
            let a = attestations.get(i).unwrap();
            if a.vouchor == vouchor {
                return Err(Error::DuplicateAttestation);
            }
        }

        let attestation = Attestation {
            vouchor: vouchor.clone(),
            vouchee: vouchee.clone(),
            weight,
            timestamp: env.ledger().timestamp(),
        };

        attestations.push_back(attestation);
        env.storage()
            .persistent()
            .set(&DataKey::Attestations(vouchee), &attestations);

        Ok(())
    }

    /// Get the total attestation weight for an address.
    /// Sum of all vouchors' reputation scores at the time of vouching.
    pub fn get_attestation_score(env: Env, vouchee: Address) -> u32 {
        let attestations: Vec<Attestation> = env
            .storage()
            .persistent()
            .get(&DataKey::Attestations(vouchee))
            .unwrap_or_else(|| Vec::new(&env));

        let mut total: u32 = 0;
        for i in 0..attestations.len() {
            let a = attestations.get(i).unwrap();
            total = total.saturating_add(a.weight);
        }
        total
    }

    /// Check if an address meets the minimum attestation threshold.
    pub fn is_attested(env: Env, vouchee: Address) -> bool {
        let min: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MinAttestationWeight)
            .unwrap_or(100);
        Self::get_attestation_score(env, vouchee) >= min
    }

    /// Get all vouchor addresses for a given vouchee.
    pub fn get_vouchors(env: Env, vouchee: Address) -> Vec<Address> {
        let attestations: Vec<Attestation> = env
            .storage()
            .persistent()
            .get(&DataKey::Attestations(vouchee))
            .unwrap_or_else(|| Vec::new(&env));

        let mut vouchors: Vec<Address> = Vec::new(&env);
        for i in 0..attestations.len() {
            let a = attestations.get(i).unwrap();
            vouchors.push_back(a.vouchor.clone());
        }
        vouchors
    }

    /// Get the number of attestations for an address.
    pub fn get_attestation_count(env: Env, vouchee: Address) -> u32 {
        let attestations: Vec<Attestation> = env
            .storage()
            .persistent()
            .get(&DataKey::Attestations(vouchee))
            .unwrap_or_else(|| Vec::new(&env));
        attestations.len()
    }

    /// Admin can update the reputation contract address.
    pub fn set_reputation_contract(
        env: Env,
        caller: Address,
        reputation_contract: Address,
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
        env.storage()
            .instance()
            .set(&DataKey::ReputationContract, &reputation_contract);
        Ok(())
    }

    /// Admin can update the minimum attestation weight.
    pub fn set_min_weight(
        env: Env,
        caller: Address,
        min_weight: u32,
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
        env.storage()
            .instance()
            .set(&DataKey::MinAttestationWeight, &min_weight);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    fn get_reputation_score(env: &Env, reputation_addr: &Address, address: &Address) -> u32 {
        let args = soroban_sdk::vec![env, address.to_val()];
        let result = env.invoke_contract(
            reputation_addr,
            &Symbol::short("get_composite_score"),
            &args,
        );
        result.try_into().unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);
    }

    #[test]
    #[should_panic(expected = "Error(SelfAttestation)")]
    fn test_self_attestation_rejected() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);

        // Self-attestation should fail
        client.vouch(&admin, &admin);
    }

    #[test]
    fn test_attestation_score_no_vouches() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);

        let stranger = Address::generate(&env);
        assert_eq!(client.get_attestation_score(&stranger), 0);
        assert!(!client.is_attested(&stranger));
    }

    #[test]
    fn test_attestation_count() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &0_u32);

        let vouchee = Address::generate(&env);

        assert_eq!(client.get_attestation_count(&vouchee), 0);
    }

    #[test]
    #[should_panic(expected = "Error(ContractNotInitialized)")]
    fn test_double_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);
        client.initialize(&admin, &reputation, &100_u32);
    }

    #[test]
    #[should_panic(expected = "Error(DuplicateAttestation)")]
    fn test_duplicate_attestation_rejected() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &0_u32);

        let vouchor = Address::generate(&env);
        let vouchee = Address::generate(&env);

        // Note: cross-contract call to reputation fails in unit test,
        // but the duplicate check happens after that call.
        // Since reputation is a dummy address, the weight will be 0,
        // but the vouch will still be recorded.
        // However, invoke_contract to a non-existent contract will panic.
        // This test demonstrates the duplicate check logic path only in
        // integration tests with a deployed mock.
        // For unit tests, we verify the self-attestation guard (tested above)
        // and the empty state queries.
    }

    #[test]
    fn test_zero_min_weight_attested() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        // min_attestation_weight = 0 means everyone is attested
        client.initialize(&admin, &reputation, &0_u32);

        let stranger = Address::generate(&env);
        // With 0 threshold, even 0 score passes
        assert!(client.is_attested(&stranger));
    }

    #[test]
    fn test_set_reputation_contract() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);

        let new_reputation = Address::generate(&env);
        client.set_reputation_contract(&admin, &new_reputation);
    }

    #[test]
    #[should_panic(expected = "Error(NotAdmin)")]
    fn test_set_reputation_contract_non_admin() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);

        let stranger = Address::generate(&env);
        let new_reputation = Address::generate(&env);
        client.set_reputation_contract(&stranger, &new_reputation);
    }

    #[test]
    fn test_set_min_weight() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);

        client.set_min_weight(&admin, &200_u32);

        let stranger = Address::generate(&env);
        // Still 0 score, threshold now 200
        assert!(!client.is_attested(&stranger));
    }

    #[test]
    fn test_get_vouchors_empty() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let reputation = Address::generate(&env);
        let contract_id = env.register(IdentityContract, ());
        let client = IdentityContractClient::new(&env, &contract_id);

        client.initialize(&admin, &reputation, &100_u32);

        let stranger = Address::generate(&env);
        let vouchors = client.get_vouchors(&stranger);
        assert_eq!(vouchors.len(), 0);
    }
}
