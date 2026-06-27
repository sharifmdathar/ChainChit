#!/usr/bin/env npx ts-node
/**
 * Deploy ChainChit contracts to Stellar network.
 *
 * Usage:
 *   NETWORK=testnet npx ts-node scripts/deploy.ts
 *
 * Requires:
 *   - SOROBAN_SECRET_KEY env var (admin secret key)
 *   - stellar-cli installed (soroban-cli)
 *   - stellar contract build already run
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { Keypair } from "@stellar/stellar-sdk";

const NETWORK = process.env.NETWORK || "testnet";
const RPC_URL =
  NETWORK === "testnet"
    ? "https://soroban-testnet.stellar.org"
    : "https://rpc.stellar.org";
const NETWORK_PASSPHRASE =
  NETWORK === "testnet"
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";

const SECRET_KEY = process.env.SOROBAN_SECRET_KEY;
if (!SECRET_KEY) {
  console.error("ERROR: SOROBAN_SECRET_KEY env var required");
  process.exit(1);
}

const ROOT_DIR = process.cwd();
const ENV_FILE = join(ROOT_DIR, "frontend", ".env.local");

interface DeployResult {
  name: string;
  contractId: string;
}

function run(cmd: string): string {
  console.log(`  > ${cmd}`);
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function runWithRetry(cmd: string, retries: number = 10): string {
  for (let i = 0; i < retries; i++) {
    try {
      return run(cmd);
    } catch (err: any) {
      const errMsg = err.stderr?.toString() || err.stdout?.toString() || err.message || '';
      const waitSec = 6 + (i * 6); // 6, 12, 18, 24...
      if (i === retries - 1) {
        console.error(`Final attempt failed: ${errMsg}`);
        throw err;
      }
      console.log(`Command failed (${errMsg.split('\n')[0]}), retrying in ${waitSec}s... (${i + 1}/${retries})`);
      try {
        execSync(`sleep ${waitSec}`);
      } catch (e) {}
    }
  }
  throw new Error("Unreachable");
}

function buildWasm(contractDir: string): string {
  const releaseDir = join(ROOT_DIR, "target", "wasm32v1-none", "release");
  const optimizedPath = join(releaseDir, `${contractDir}.wasm`);

  // Always rebuild to ensure the WASM matches current source
  console.log(`Building ${contractDir}...`);
  run(`stellar contract build --package ${contractDir} 2>&1`);

  // Prefer the optimized wasm in release root (not deps/)
  if (existsSync(optimizedPath)) return optimizedPath;

  // Fallback: search for it
  const findCmd = `find ${releaseDir} -maxdepth 1 -name "${contractDir}*.wasm" -type f 2>/dev/null | head -1`;
  const found = run(findCmd);
  if (found) return found;

  throw new Error(`WASM not found for ${contractDir} after build`);
}

function deployWasm(wasmPath: string): string {
  console.log(`Deploying ${wasmPath}...`);
  const output = runWithRetry(
    `stellar contract deploy --wasm ${wasmPath} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} 2>&1`
  );
  // Extract contract ID from output
  const match = output.match(/[A-Z0-9]{56}/);
  if (!match) {
    throw new Error(`Failed to parse contract ID from: ${output}`);
  }
  return match[0];
}

function invokeInit(
  contractId: string,
  method: string,
  args: string
): void {
  console.log(`Initializing ${method}...`);
  runWithRetry(
    `stellar contract invoke --id ${contractId} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} -- ${method} ${args} 2>&1`
  );
}

function installWasm(wasmPath: string): string {
  console.log(`Installing ${wasmPath}...`);
  const output = runWithRetry(
    `stellar contract upload --wasm ${wasmPath} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} 2>&1`
  );
  // Get the LAST 64-char hex hash (skips deprecation warnings etc.)
  const matches = output.match(/[a-f0-9]{64}/g);
  if (!matches || matches.length === 0) {
    throw new Error(`Failed to parse wasm hash from: ${output}`);
  }
  return matches[matches.length - 1];
}

async function main() {
  console.log(`\n=== ChainChit Deployment (${NETWORK}) ===\n`);

  const contracts = [
    { name: "reputation", package: "reputation" },
    { name: "identity", package: "identity" },
    { name: "dispute", package: "dispute" },
    { name: "factory", package: "factory" },
  ];

  const deployed: DeployResult[] = [];

  // 1. Build all WASMs
  console.log("Step 1: Building contracts...\n");
  for (const c of contracts) {
    buildWasm(c.package);
  }
  const chitGroupWasm = buildWasm("chit_group");

  // 2. Deploy/Install
  console.log("\nStep 2: Deploying & Installing contracts...\n");
  for (const c of contracts) {
    const wasmPath = buildWasm(c.package);
    const contractId = deployWasm(wasmPath);
    deployed.push({ name: c.name, contractId });
    console.log(`  ✓ ${c.name}: ${contractId}\n`);
  }
  
  const chitGroupHash = installWasm(chitGroupWasm);
  console.log(`  ✓ chit_group (installed hash): ${chitGroupHash}\n`);

  const reputationId = deployed.find((d) => d.name === "reputation")!.contractId;
  const identityId = deployed.find((d) => d.name === "identity")!.contractId;
  const disputeId = deployed.find((d) => d.name === "dispute")!.contractId;
  const factoryId = deployed.find((d) => d.name === "factory")!.contractId;

  // 3. Initialize contracts
  console.log("Step 3: Initializing contracts...\n");

  // Derive admin address from secret key
  let adminAddress = "";
  try {
    adminAddress = Keypair.fromSecret(SECRET_KEY!).publicKey();
  } catch (err) {
    console.error("WARNING: Could not derive admin address from secret key.", err);
  }

  if (!adminAddress) {
    console.error("WARNING: Could not derive admin address. Manual init required.");
  } else {
    const dummy1 = Keypair.random().publicKey();
    const dummy2 = Keypair.random().publicKey();

    // Init Reputation
    invokeInit(
      reputationId,
      "initialize",
      `--admin ${adminAddress} --min_payments_for_trust 3`
    );

    // Init Identity
    invokeInit(
      identityId,
      "initialize",
      `--admin ${adminAddress} --reputation_contract ${reputationId} --min_attestation_weight 100`
    );

    // Init Dispute
    invokeInit(
      disputeId,
      "initialize",
      `--admin ${adminAddress} --arbitrators '["${adminAddress}", "${dummy1}", "${dummy2}"]' --required_votes 2 --reputation_contract ${reputationId}`
    );

    // Init Factory
    invokeInit(
      factoryId,
      "initialize",
      `--admin ${adminAddress} --wasm_hash ${chitGroupHash} --reputation_contract ${reputationId} --identity_contract ${identityId} --dispute_contract ${disputeId}`
    );

    // Set Factory in Reputation
    console.log("Setting Factory in Reputation...");
    runWithRetry(
      `stellar contract invoke --id ${reputationId} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} -- set_factory --caller ${adminAddress} --factory ${factoryId} 2>&1`
    );

    // Set Factory in Dispute
    console.log("Setting Factory in Dispute...");
    runWithRetry(
      `stellar contract invoke --id ${disputeId} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} -- set_factory --caller ${adminAddress} --factory ${factoryId} 2>&1`
    );
  }

  // 4. Write env file
  console.log("\nStep 4: Writing .env.local...\n");
  const envContent = `# Auto-generated by deploy.ts — ${new Date().toISOString()}
NEXT_PUBLIC_NETWORK=${NETWORK.toUpperCase()}
NEXT_PUBLIC_STELLAR_RPC_URL=${RPC_URL}
NEXT_PUBLIC_FACTORY_CONTRACT=${factoryId}
NEXT_PUBLIC_REPUTATION_CONTRACT=${reputationId}
NEXT_PUBLIC_IDENTITY_CONTRACT=${identityId}
NEXT_PUBLIC_DISPUTE_CONTRACT=${disputeId}
NEXT_PUBLIC_USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
NEXT_PUBLIC_ANCHOR_SEP24_URL=https://testanchor.stellar.org/sep24

# Frontend alternate contract naming conventions
NEXT_PUBLIC_CONTRACT_FACTORY=${factoryId}
NEXT_PUBLIC_CONTRACT_REPUTATION=${reputationId}
NEXT_PUBLIC_CONTRACT_IDENTITY=${identityId}
NEXT_PUBLIC_CONTRACT_DISPUTE=${disputeId}
NEXT_PUBLIC_CONTRACT_USDC=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
`;
  writeFileSync(ENV_FILE, envContent);
  console.log(`  ✓ Written to ${ENV_FILE}\n`);

  // 5. Summary
  console.log("=== Deployment Summary ===\n");
  for (const d of deployed) {
    console.log(`  ${d.name}: ${d.contractId}`);
  }
  console.log(`  chit_group (hash): ${chitGroupHash}`);
  console.log(`\n  Network: ${NETWORK}`);
  console.log(`  Admin: ${adminAddress || "(manual init required)"}`);
  console.log("\nDone! Run `cd frontend && npm run dev` to start the app.\n");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});

