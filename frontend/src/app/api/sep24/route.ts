import { NextRequest, NextResponse } from "next/server";

const ANCHOR_DOMAIN = process.env.ANCHOR_SEP24_URL || process.env.NEXT_PUBLIC_ANCHOR_SEP24_URL || "";
if (!ANCHOR_DOMAIN) {
  throw new Error("ANCHOR_SEP24_URL env var not configured");
}
const SEP10_AUTH = `${ANCHOR_DOMAIN}/auth`;
const SEP24_BASE = `${ANCHOR_DOMAIN}/sep24`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "get_challenge") {
      const { account } = body;
      if (!account) {
        return NextResponse.json({ error: "Account required" }, { status: 400 });
      }
      const challengeRes = await fetch(`${SEP10_AUTH}?account=${account}`);
      if (!challengeRes.ok) {
        throw new Error(`SEP-10 challenge failed: ${challengeRes.status}`);
      }
      const data = await challengeRes.json();
      return NextResponse.json(data);
    }

    if (action === "submit_signed_challenge") {
      const { transaction, type, amount, account } = body;
      if (!transaction || !account) {
        return NextResponse.json({ error: "Transaction and Account required" }, { status: 400 });
      }

      // 1. Submit signed challenge for JWT
      const tokenRes = await fetch(SEP10_AUTH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction }),
      });
      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        throw new Error(`SEP-10 token exchange failed: ${tokenRes.status} ${text}`);
      }
      const { token } = await tokenRes.json();

      // 2. Build SEP-24 interactive request
      const endpoint =
        type === "withdraw"
          ? `${SEP24_BASE}/transactions/withdraw/interactive`
          : `${SEP24_BASE}/transactions/deposit/interactive`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error("SEP-24 proxy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
