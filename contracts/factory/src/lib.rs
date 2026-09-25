#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Symbol, Vec, vec,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    WasmHash,
    ReputationContract,
    IdentityContract,
    DisputeContract,
    UserGroups(Address), // Map user Address to Vec<Address> of groups they created
    GroupCount,          // Total number of groups ever deployed (instance storage)
    GroupAt(u32),        // Persistent index -> group address, for public discovery
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    NotAdmin = 1,
    AlreadyInitialized = 2,
    NotInitialized = 3,
}

#[contract]
pub struct ChitGroupFactory;

#[contractimpl]
impl ChitGroupFactory {
    /// Initialize the factory with the admin and the WASM hash of the chit_group contract.
    pub fn initialize(
        env: Env,
        admin: Address,
        wasm_hash: BytesN<32>,
        reputation_contract: Address,
        identity_contract: Address,
        dispute_contract: Address,
    ) -> Result<(), Error> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::WasmHash, &wasm_hash);
        env.storage().instance().set(&DataKey::ReputationContract, &reputation_contract);
        env.storage().instance().set(&DataKey::IdentityContract, &identity_contract);
        env.storage().instance().set(&DataKey::DisputeContract, &dispute_contract);
        Ok(())
    }

    /// Deploy a new ChitGroup contract and initialize it.
    pub fn create_group(
        env: Env,
        caller: Address,
        salt: BytesN<32>,
        token: Address,
        contribution_amount: u64,
        num_members: u32,
        total_cycles: u32,
        min_attestation_score: u32,
        min_reputation_for_bid: u32,
    ) -> Result<Address, Error> {
        caller.require_auth();

        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::WasmHash)
            .ok_or(Error::NotInitialized)?;
            
        let reputation_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::ReputationContract)
            .ok_or(Error::NotInitialized)?;
            
        let identity_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::IdentityContract)
            .ok_or(Error::NotInitialized)?;
            
        let dispute_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::DisputeContract)
            .ok_or(Error::NotInitialized)?;

        // Deploy the contract
        let deployer = env.deployer().with_address(caller.clone(), salt);
        let deployed_address = deployer.deploy_v2(wasm_hash, ());

        use soroban_sdk::IntoVal;

        // Initialize the deployed group
        let init_args = vec![
            &env,
            caller.to_val(),
            token.to_val(),
            reputation_contract.to_val(),
            identity_contract.to_val(),
            dispute_contract.to_val(),
            contribution_amount.into_val(&env),
            num_members.into_val(&env),
            total_cycles.into_val(&env),
            min_attestation_score.into_val(&env),
            min_reputation_for_bid.into_val(&env),
        ];

        env.invoke_contract::<()>(&deployed_address, &Symbol::new(&env, "initialize"), init_args);

        // Authorize group in Reputation and Dispute
        let auth_args = vec![
            &env,
            env.current_contract_address().to_val(),
            deployed_address.to_val(),
        ];
        env.invoke_contract::<()>(&reputation_contract, &Symbol::new(&env, "authorize_group"), auth_args.clone());
        env.invoke_contract::<()>(&dispute_contract, &Symbol::new(&env, "authorize_group"), auth_args);

        // Store the group in the caller's list of created groups
        let mut user_groups: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::UserGroups(caller.clone()))
            .unwrap_or_else(|| Vec::new(&env));
            
        user_groups.push_back(deployed_address.clone());
        env.storage()
            .instance()
            .set(&DataKey::UserGroups(caller.clone()), &user_groups);

        // Append to the global registry so groups can be discovered publicly.
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::GroupCount)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::GroupAt(count), &deployed_address);
        env.storage()
            .instance()
            .set(&DataKey::GroupCount, &(count + 1));

        Ok(deployed_address)
    }

    /// Total number of groups ever deployed through this factory.
    pub fn get_group_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::GroupCount)
            .unwrap_or(0)
    }

    /// Address of the group deployed at `index` (0-based), if any.
    pub fn get_group_at(env: Env, index: u32) -> Option<Address> {
        env.storage().persistent().get(&DataKey::GroupAt(index))
    }

    /// A paginated slice of deployed group addresses in creation order.
    pub fn get_groups(env: Env, start: u32, max: u32) -> Vec<Address> {
        let count = Self::get_group_count(env.clone());
        let mut out: Vec<Address> = Vec::new(&env);
        let mut i = start;
        while i < count && out.len() < max {
            if let Some(addr) = Self::get_group_at(env.clone(), i) {
                out.push_back(addr);
            }
            i += 1;
        }
        out
    }

    /// Admin-only: update the stored chit_group WASM hash.
    pub fn update_wasm_hash(
        env: Env,
        caller: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if caller != admin {
            return Err(Error::NotAdmin);
        }
        env.storage()
            .instance()
            .set(&DataKey::WasmHash, &new_wasm_hash);
        Ok(())
    }

    /// Get all groups created by a specific user.
    pub fn get_user_groups(env: Env, user: Address) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::UserGroups(user))
            .unwrap_or_else(|| Vec::new(&env))
    }
}
