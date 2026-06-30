import { NextResponse } from "next/server";
import * as sdk from "@stellar/stellar-sdk";

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const server = new sdk.Horizon.Server("https://horizon-testnet.stellar.org");
    const secretKey = process.env.MOCK_ACCOUNT_SECRET || "SDLCGLQDC72C5WRR7IX3E74TJE46SIKIDB52ANJQMGHNQSDJ5SJZFWUG";
    const sourceKeypair = sdk.Keypair.fromSecret(secretKey);
    const sourceAddress = sourceKeypair.publicKey();

    console.log(`[FAUCET] Funding ${address} from ${sourceAddress}...`);
    const account = await server.loadAccount(sourceAddress);

    const asset = new sdk.Asset(
      "USDC",
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    );

    const tx = new sdk.TransactionBuilder(account, {
      fee: sdk.BASE_FEE,
      networkPassphrase: "Test SDF Network ; September 2015",
    })
      .addOperation(
        sdk.Operation.payment({
          destination: address,
          asset: asset,
          amount: "50.0",
        })
      )
      .setTimeout(60)
      .build();

    tx.sign(sourceKeypair);

    const result = await server.submitTransaction(tx);
    return NextResponse.json({ success: true, hash: result.hash });
  } catch (err: any) {
    console.error("[FAUCET ERROR]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
