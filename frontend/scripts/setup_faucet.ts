/**
 * setup_faucet.ts — Prepare the faucet wallet: fund via Friendbot if new,
 * then establish the testnet USDC trustline so sweeps/payouts can move USDC.
 *
 * Usage (from frontend/):
 *   SOROBAN_SECRET_KEY=S… npx tsx scripts/setup_faucet.ts
 */
import { Keypair, TransactionBuilder, Asset, Operation, Horizon } from "@stellar/stellar-sdk";

try {
  const fs = require("fs");
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* env file optional */
}

const SECRET = process.env.SOROBAN_SECRET_KEY;
const ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
if (!SECRET) throw new Error("SOROBAN_SECRET_KEY env var required");

const kp = Keypair.fromSecret(SECRET);
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const PASSPHRASE = "Test SDF Network ; September 2015";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  console.log(`faucet wallet: ${kp.publicKey()}`);
  try {
    await horizon.loadAccount(kp.publicKey());
    console.log("account exists on testnet");
  } catch {
    console.log("account missing — funding via friendbot…");
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(kp.publicKey())}`);
    if (!res.ok) throw new Error(`friendbot failed: ${res.status}`);
    console.log("funded");
    await sleep(6000);
  }

  const acc = await horizon.loadAccount(kp.publicKey());
  const hasTrustline = (acc.balances as { asset_code?: string; asset_issuer?: string }[]).some(
    (b) => b.asset_code === "USDC" && b.asset_issuer === ISSUER
  );
  if (hasTrustline) {
    console.log("USDC trustline already present");
    return;
  }
  console.log("establishing USDC trustline…");
  const tx = new TransactionBuilder(acc, { fee: "50000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: new Asset("USDC", ISSUER) }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
  console.log("done — wallet can now receive testnet USDC");
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
