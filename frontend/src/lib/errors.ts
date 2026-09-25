// Map cryptic Soroban / contract / RPC error strings into friendly, actionable
// copy. Kept pure (no SDK or React) so it is unit-testable and reusable from
// any presentation site. Contract codes come from the chit_group `Error` enum.

const CHIT_GROUP_ERRORS: Record<number, string> = {
  1: "Only the group admin can do that.",
  2: "The group isn't in the right state for this action.",
  3: "You're already a member of this group.",
  4: "You're not a member of this group yet — join first.",
  5: "This group is full — no spots left.",
  6: "Your payment didn't cover the required contribution.",
  7: "You've already paid for this cycle.",
  8: "You've already committed a bid this cycle.",
  9: "That reveal doesn't match your committed bid. Double-check the amount and nonce.",
  10: "Your bid is too low for this pool.",
  11: "You need at least one vouch before joining this group.",
  12: "This group is paused. Please try again later.",
  13: "You're not authorized to perform this action.",
  14: "This group is no longer forming new members.",
  15: "The group isn't collecting contributions right now.",
  16: "Bidding isn't open for this cycle yet.",
  17: "The group isn't in the payout stage.",
  18: "No bids were placed this cycle.",
  19: "That amount isn't valid.",
  20: "This contract isn't registered/initialised yet.",
  21: "That cycle doesn't exist.",
  22: "This bid hasn't been revealed yet.",
  23: "No valid bids to pick a winner from.",
  24: "This cycle is already completed.",
  25: "Your reputation is below this group's minimum to bid.",
  26: "You've already revealed your bid this cycle.",
  27: "The collection deadline hasn't passed yet.",
  28: "Nothing was collected, so there's nothing to pay out.",
  29: "You haven't paid your contribution for this cycle yet.",
};

// Ordered heuristics for the non-code failures surfaced by wallets / RPC.
const PATTERNS: { re: RegExp; message: string }[] = [
  { re: /user rejected|rejected by the user|denied|cancel(?:l)?ed|requestDenied/i, message: "You cancelled the request in your wallet." },
  { re: /not connected|no public key|wallet.*connect|connect.*wallet/i, message: "Connect your wallet to continue." },
  { re: /insufficient (?:balance|funds)|not enough|low reserve|op_?underfunded|need.*trust ?line|asset.*missing/i, message: "Not enough funds or a missing USDC trustline. Top up and retry." },
  { re: /timed? ?out|expiry|not_found.*after|too late/i, message: "The network didn't confirm in time. Your transaction may still land — check again shortly." },
  { re: /nonce|sequence/i, message: "Your wallet has a pending transaction. Wait for it to clear, then retry." },
  { re: /simulation error|status=error|host function|wasm trap|contract execution/i, message: "The contract rejected this action." },
];

// Contract error codes appear as `Error(Contract, #N)` (sometimes `#0x…`).
function extractCode(raw: string): number | null {
  const dec = raw.match(/Error\(Contract,\s*#(\d+)\)/i);
  if (dec) return Number(dec[1]);
  const hex = raw.match(/Error\(Contract,\s*#0x([0-9a-f]+)\)/i);
  if (hex) return parseInt(hex[1], 16);
  return null;
}

export function friendlySorobanError(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "Something went wrong. Please try again.";
  const code = extractCode(trimmed);
  if (code !== null && CHIT_GROUP_ERRORS[code]) return CHIT_GROUP_ERRORS[code];
  for (const { re, message } of PATTERNS) if (re.test(trimmed)) return message;
  // Unknown but non-empty: keep it short rather than dumping a stack of XDR.
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

export function friendlyError(err: unknown): string {
  if (err instanceof Error) return friendlySorobanError(err.message);
  if (typeof err === "string") return friendlySorobanError(err);
  return "Something went wrong. Please try again.";
}
