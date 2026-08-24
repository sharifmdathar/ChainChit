import { NextResponse } from "next/server";
import * as sdk from "@stellar/stellar-sdk";

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const secretKey = process.env.MOCK_ACCOUNT_SECRET;
    if (!secretKey) {
      return NextResponse.json({ error: "MOCK_ACCOUNT_SECRET env var not configured" }, { status: 500 });
    }
    const sourceKeypair = sdk.Keypair.fromSecret(secretKey);
    const sourceAddress = sourceKeypair.publicKey();

    const network = process.env.NEXT_PUBLIC_NETWORK || "TESTNET";
    // Faucet funds accounts with the MOCK_ACCOUNT_SECRET's balance. On PUBLIC
    // (mainnet) that would spend real USDC/XLM, so the faucet is testnet-only.
    if (network !== "TESTNET") {
      return NextResponse.json(
        { error: "Faucet is testnet-only. On mainnet, fund accounts via direct USDC transfer." },
        { status: 403 }
      );
    }
    const networkPassphrase = "Test SDF Network ; September 2015";
    const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "";
    if (!rpcUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_STELLAR_RPC_URL env var not configured" }, { status: 500 });
    }
    const usdcContractId = process.env.NEXT_PUBLIC_USDC_CONTRACT;
    if (!usdcContractId) {
      return NextResponse.json({ error: "NEXT_PUBLIC_USDC_CONTRACT env var not configured" }, { status: 500 });
    }

    // Payout configurable via FAUCET_USDC_AMOUNT (default 10) — keeps the
    // testnet faucet wallet alive across many demo clicks.
    const payoutUsdc = Number(process.env.FAUCET_USDC_AMOUNT) > 0 ? Number(process.env.FAUCET_USDC_AMOUNT) : 10;
    const amount = BigInt(payoutUsdc) * BigInt(10_000_000);

    console.log(
      `[FAUCET] Funding ${address} with ${payoutUsdc} Soroban USDC from ${sourceAddress}...`
    );

    const server = new sdk.rpc.Server(rpcUrl, { allowHttp: false });
    const account = await server.getAccount(sourceAddress);
    const contract = new sdk.Contract(usdcContractId);

    const tx = new sdk.TransactionBuilder(account, {
      fee: "10000000",
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          "transfer",
          sdk.Address.fromString(sourceAddress).toScVal(),
          sdk.Address.fromString(address).toScVal(),
          sdk.xdr.ScVal.scvI128(
            new sdk.xdr.Int128Parts({
              lo: new sdk.xdr.Uint64(amount),
              hi: new sdk.xdr.Int64(0),
            })
          )
        )
      )
      .setTimeout(60)
      .build();

    // Simulate to get footprint + auth + fee
    const simResponse = await server.simulateTransaction(tx);
    if (sdk.rpc.Api.isSimulationError(simResponse)) {
      throw new Error(`Simulation error: ${simResponse.error}`);
    }

    // Assemble with simulation data, sign, submit
    const assembledTx = sdk.rpc.assembleTransaction(tx, simResponse).build();
    assembledTx.sign(sourceKeypair);

    const sendResponse = await server.sendTransaction(assembledTx);
    if (sendResponse.status === "ERROR") {
      throw new Error(`Transaction failed: ${sendResponse.errorResult}`);
    }

    // Wait for confirmation
    let pollResponse = await server.getTransaction(sendResponse.hash);
    let attempts = 0;
    while (pollResponse.status === "NOT_FOUND" && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      pollResponse = await server.getTransaction(sendResponse.hash);
      attempts++;
    }

    if (pollResponse.status === "FAILED") {
      throw new Error(`Transaction reverted on chain: ${pollResponse.resultXdr}`);
    }

    return NextResponse.json({ success: true, hash: sendResponse.hash });
  } catch (err) {
    console.error("[FAUCET ERROR]", err);

    let message = err instanceof Error ? err.message : String(err);
    if (message.includes("trustline entry is missing")) {
      message =
        "USDC trustline not found. Click 'Add USDC Trustline' button first, then try the faucet again.";
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
