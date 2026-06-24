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

function buildWasm(contractDir: string): string {
  const wasmPath = join(
    ROOT_DIR,
    "target",
    "wasm32v1-none",
    "release",
    `${contractDir.replace(/_/g, "_")}.wasm`
  );

  // Find the actual wasm file
  const findCmd = `find ${join(ROOT_DIR, "target", "wasm32v1-none", "release")} -name "${contractDir}*.wasm" -type f 2>/dev/null | head -1`;
  const found = run(findCmd);
  if (found) return found;

  console.log(`Building ${contractDir}...`);
  run(`stellar contract build --package ${contractDir} 2>&1`);
  const afterBuild = run(findCmd);
  if (!afterBuild) {
    throw new Error(`WASM not found for ${contractDir}`);
  }
  return afterBuild;
}

function deployWasm(wasmPath: string): string {
  console.log(`Deploying ${wasmPath}...`);
  const output = run(
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
  run(
    `stellar contract invoke --id ${contractId} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} -- ${method} ${args} 2>&1`
  );
}

async function main() {
  console.log(`\n=== ChainChit Deployment (${NETWORK}) ===\n`);

  const contracts = [
    { name: "reputation", package: "reputation" },
    { name: "identity", package: "identity" },
    { name: "dispute", package: "dispute" },
    { name: "chit_group", package: "chit_group" },
  ];

  const deployed: DeployResult[] = [];

  // 1. Build all WASMs
  console.log("Step 1: Building contracts...\n");
  for (const c of contracts) {
    buildWasm(c.package);
  }

  // 2. Deploy in dependency order (reputation first, then identity/dispute, then chit_group)
  console.log("\nStep 2: Deploying contracts...\n");
  for (const c of contracts) {
    const wasmPath = buildWasm(c.package);
    const contractId = deployWasm(wasmPath);
    deployed.push({ name: c.name, contractId });
    console.log(`  ✓ ${c.name}: ${contractId}\n`);
  }

  const reputationId = deployed.find((d) => d.name === "reputation")!.contractId;
  const identityId = deployed.find((d) => d.name === "identity")!.contractId;
  const disputeId = deployed.find((d) => d.name === "dispute")!.contractId;
  const chitGroupId = deployed.find((d) => d.name === "chit_group")!.contractId;

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

    // Authorize ChitGroup contract in Reputation
    console.log("Authorizing ChitGroup in Reputation...");
    run(
      `stellar contract invoke --id ${reputationId} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} -- authorize_group --caller ${adminAddress} --group ${chitGroupId} 2>&1`
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

    // Authorize ChitGroup contract in Dispute
    console.log("Authorizing ChitGroup in Dispute...");
    run(
      `stellar contract invoke --id ${disputeId} --source ${SECRET_KEY} --network-passphrase "${NETWORK_PASSPHRASE}" --rpc-url ${RPC_URL} -- authorize_group --caller ${adminAddress} --group ${chitGroupId} 2>&1`
    );
  }

  // 4. Write env file
  console.log("\nStep 4: Writing .env.local...\n");
  const envContent = `# Auto-generated by deploy.ts — ${new Date().toISOString()}
NEXT_PUBLIC_NETWORK=${NETWORK.toUpperCase()}
NEXT_PUBLIC_STELLAR_RPC_URL=${RPC_URL}
NEXT_PUBLIC_CHIT_GROUP_CONTRACT=${chitGroupId}
NEXT_PUBLIC_REPUTATION_CONTRACT=${reputationId}
NEXT_PUBLIC_IDENTITY_CONTRACT=${identityId}
NEXT_PUBLIC_DISPUTE_CONTRACT=${disputeId}
NEXT_PUBLIC_USDC_CONTRACT=CCW67TSUGAEKE6SPMB5IKCTXZQH5HM6F3TGH4XLCSKL5Y5HEKUC7OS2A
NEXT_PUBLIC_ANCHOR_SEP24_URL=https://testanchor.stellar.org/sep24

# Frontend alternate contract naming conventions
NEXT_PUBLIC_CONTRACT_CHIT_GROUP=${chitGroupId}
NEXT_PUBLIC_CONTRACT_REPUTATION=${reputationId}
NEXT_PUBLIC_CONTRACT_IDENTITY=${identityId}
NEXT_PUBLIC_CONTRACT_DISPUTE=${disputeId}
NEXT_PUBLIC_CONTRACT_USDC=CCW67TSUGAEKE6SPMB5IKCTXZQH5HM6F3TGH4XLCSKL5Y5HEKUC7OS2A
`;
  writeFileSync(ENV_FILE, envContent);
  console.log(`  ✓ Written to ${ENV_FILE}\n`);

  // 5. Summary
  console.log("=== Deployment Summary ===\n");
  for (const d of deployed) {
    console.log(`  ${d.name}: ${d.contractId}`);
  }
  console.log(`\n  Network: ${NETWORK}`);
  console.log(`  Admin: ${adminAddress || "(manual init required)"}`);
  console.log("\nDone! Run `cd frontend && npm run dev` to start the app.\n");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
