import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk";

const ANCHOR_DOMAIN = "https://testanchor.stellar.org";
const SEP10_AUTH = `${ANCHOR_DOMAIN}/auth`;
const SEP24_BASE = `${ANCHOR_DOMAIN}/sep24`;
const DEMO_SECRET = "SDLCGLQDC72C5WRR7IX3E74TJE46SIKIDB52ANJQMGHNQSDJ5SJZFWUG";

/**
 * SEP-10 authentication: get a challenge, sign it, receive a JWT.
 */
async function getSep10Token(publicKey: string): Promise<string> {
  // 1. Request challenge
  const challengeRes = await fetch(
    `${SEP10_AUTH}?account=${publicKey}`
  );
  if (!challengeRes.ok) {
    throw new Error(`SEP-10 challenge failed: ${challengeRes.status}`);
  }
  const { transaction } = await challengeRes.json();

  // 2. Sign challenge with demo keypair
  const keypair = Keypair.fromSecret(DEMO_SECRET);
  const tx = TransactionBuilder.fromXDR(
    transaction,
    Networks.TESTNET
  );
  tx.sign(keypair);

  // 3. Submit signed challenge for JWT
  const tokenRes = await fetch(SEP10_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`SEP-10 token exchange failed: ${tokenRes.status} ${text}`);
  }
  const { token } = await tokenRes.json();
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, amount, account } = body;

    if (!account) {
      return NextResponse.json({ error: "Account required" }, { status: 400 });
    }

    // Authenticate with the anchor via SEP-10
    const jwt = await getSep10Token(account);

    // Build SEP-24 interactive request
    const endpoint =
      type === "withdraw"
        ? `${SEP24_BASE}/transactions/withdraw/interactive`
        : `${SEP24_BASE}/transactions/deposit/interactive`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset_code: "USDC",
        amount: amount || "10",
        account,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Anchor responded ${response.status}: ${text}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error("SEP-24 proxy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
