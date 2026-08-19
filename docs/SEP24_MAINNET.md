# ChainChit — SEP-24 Anchor on Mainnet: Decision

## Status: testnet mock anchor → mainnet needs real anchor

Testnet used a mock anchor flow (`NEXT_PUBLIC_ANCHOR_SEP24_URL` pointing at a
mock interactive portal). On mainnet that mock does not exist — real anchor
needed. Research (Aug 2026):

## Candidate anchors

| Anchor | Status | SEP-24 endpoint | Currencies | KYC | Notes |
|--------|--------|-----------------|------------|-----|-------|
| **MoneyGram Ramps** | ✅ LIVE mainnet | `https://mgxanchor.moneygram.com/stellarsepservice/sep24` (stellar.toml: `https://mgxanchor.moneygram.com/.well-known/stellar.toml`) | USDC, 170+ countries cash in/out | MoneyGram handles | Requires partner-portal allowlist + KYB + legal agreement before production go-live. Min 15 USDC / max 950 (on), 2500 (off) |
| **NordStern (Kori PAY / INRx)** | ⚠️ TESTNET | sandbox only (`nordstern.live`) | INR ↔ USDC, UPI/IMPS/RTGS/NEFT | Didit pipeline | India-focused anchor infrastructure, not yet mainnet-go-live. Watch for production launch |
| **Other anchors** | varies | — | — | — | Check [anchors.stellar.org](https://anchors.stellar.org) directory |

## Recommendation for mainnet MVP

1. **Ship mainnet with direct USDC funding** (no anchor dependency):
   - New users receive USDC via direct transfer (admin funding script or another
     wallet). Documented in README "Funding" section.
   - Sep24Ramp component already renders a graceful "anchor not configured"
     state when `NEXT_PUBLIC_ANCHOR_SEP24_URL` is empty — leave it unset on
     mainnet initially.
2. **Apply to MoneyGram Ramps in parallel** — production SEP-24 USDC ramp is
   real and operational; onboarding (allowlist → KYB → legal → go-live) is the
   only blocker. Target: complete before next growth cycle.
3. **Track NordStern** for native INR ramp — the natural long-term fit for a
   chit fund (India-heavy user base), once mainnet.
4. If user asks for INR specifically today: point them to manual funding with
   clear instructions, revisit after anchor go-live.

## Fallback: manual funding flow (documented)

```text
User creates Freighter wallet
  → shares G... address in Google Form
  → admin (or user) sends USDC directly from an exchange/anchor
  → user adds USDC trustline → joins group
```

Keep this path alive in README so mainnet launch never blocks on anchor KYB.