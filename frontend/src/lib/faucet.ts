/**
 * Faucet payout configuration. Single source of truth for both the API
 * route and the UI label, so the advertised amount never drifts from the
 * actual transfer.
 *
 * Precedence: FAUCET_USDC_AMOUNT (server) > NEXT_PUBLIC_FAUCET_USDC_AMOUNT (build-time) > 10.
 */
export function faucetUsdcAmount(): number {
  const raw = process.env.FAUCET_USDC_AMOUNT || process.env.NEXT_PUBLIC_FAUCET_USDC_AMOUNT;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 10;
}
