// "What-if" chit planner: pure, dependency-free math that lets a user model a
// rotating savings pool before deploying it. Everything works in whole currency
// units (e.g. dollars/USDC), never base units, so the numbers stay readable and
// the functions are trivially unit-testable.
//
// Model notes (transparent estimates, not audited finance):
//  - Each cycle the pool is auctioned; the winner accepts a `discount` (they take
//    less cash) and that discount is shared as a dividend among the other members.
//  - A member wins the pot once (in `winCycle`) and collects the dividend on every
//    other cycle. When cycles == members everyone wins exactly once, so the run is
//    nominally zero-sum: everyone puts in and takes out the same. The real,
//    per-person difference is *timing* — how long your cash is locked up and how
//    much you must fund out-of-pocket before the pot lands. That is what this
//    planner surfaces, because it is the part that actually matters day to day.

export interface ChitPlanInput {
  members: number; // n
  contribution: number; // per-cycle payment
  cycles: number; // number of cycles in the run
  discountPct: number; // typical auction discount as a % of the pool (0..99)
  cycleMonths: number; // length of one cycle in months (1 = monthly, 3 = quarterly)
}

export interface ChitMetrics {
  pool: number; // members * contribution
  discountAmount: number; // pool * discountPct / 100
  winnerPayout: number; // pool - discountAmount (cash the cycle winner receives)
  dividendPerMember: number; // discount shared among the non-winning members
  netContribution: number; // contribution a non-winner effectively pays after dividend
  totalContributed: number; // contribution * cycles
  runMonths: number; // cycles * cycleMonths
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Sanitise raw user input so downstream math never divides by zero or runs on
// nonsense (empty fields, negative counts, etc.).
export function normalise(input: ChitPlanInput): ChitPlanInput {
  const members = Math.max(2, Math.floor(input.members) || 2);
  const contribution = Math.max(0, input.contribution || 0);
  const cycles = Math.max(1, Math.floor(input.cycles) || 1);
  const discountPct = clamp(input.discountPct || 0, 0, 99);
  const cycleMonths = Math.max(0.25, input.cycleMonths || 1);
  return { members, contribution, cycles, discountPct, cycleMonths };
}

export function deriveMetrics(raw: ChitPlanInput): ChitMetrics {
  const { members, contribution, cycles, discountPct, cycleMonths } = normalise(raw);
  const pool = members * contribution;
  const discountAmount = (pool * discountPct) / 100;
  const winnerPayout = pool - discountAmount;
  const dividendPerMember = members > 1 ? discountAmount / (members - 1) : 0;
  const netContribution = contribution - dividendPerMember;
  const totalContributed = contribution * cycles;
  const runMonths = cycles * cycleMonths;
  return { pool, discountAmount, winnerPayout, dividendPerMember, netContribution, totalContributed, runMonths };
}

// Per-cycle net cashflow from one member's view if they win the pot in `winCycle`
// (1-indexed). Positive = money in that cycle, negative = money out.
export function cashflowsForWin(raw: ChitPlanInput, winCycle: number): number[] {
  const input = normalise(raw);
  const m = deriveMetrics(input);
  const flows: number[] = [];
  for (let p = 1; p <= input.cycles; p++) {
    if (p === winCycle) flows.push(m.winnerPayout - input.contribution);
    else flows.push(m.dividendPerMember - input.contribution);
  }
  return flows;
}

// Running cash position (cumulative sum) after each cycle.
export function cumulativeCashflows(raw: ChitPlanInput, winCycle: number): number[] {
  let acc = 0;
  return cashflowsForWin(raw, winCycle).map((f) => (acc += f));
}

export interface WinScenario {
  winCycle: number; // 1-indexed cycle in which this member takes the pot
  winMonth: number; // month the pot lands ((winCycle - 1) * cycleMonths)
  totalPaid: number;
  lump: number; // cash received at win time (winnerPayout)
  dividends: number; // total dividend income across the non-winning cycles
  netProfit: number; // lump + dividends - totalPaid (≈0; the difference is timing)
  peakFunding: number; // max out-of-pocket before the pot lands (≥0)
  breakevenCycle: number; // first cycle where cumulative position is ≥ 0
}

// Liquidity profile for a member who wins the pot in `winCycle`.
export function scenarioForWin(raw: ChitPlanInput, winCycle: number): WinScenario {
  const input = normalise(raw);
  const m = deriveMetrics(input);
  const cycle = clamp(Math.floor(winCycle) || 1, 1, input.cycles);

  const cum = cumulativeCashflows(input, cycle);
  const minPos = Math.min(...cum);
  const peakFunding = minPos < 0 ? -minPos : 0;
  const breakevenIdx = cum.findIndex((c) => c >= -1e-9);

  const dividends = m.dividendPerMember * (input.cycles - 1);
  const netProfit = m.winnerPayout + dividends - m.totalContributed;

  return {
    winCycle: cycle,
    winMonth: (cycle - 1) * input.cycleMonths,
    totalPaid: m.totalContributed,
    lump: m.winnerPayout,
    dividends,
    netProfit,
    peakFunding,
    breakevenCycle: breakevenIdx === -1 ? input.cycles : breakevenIdx + 1,
  };
}

// One scenario per possible win position, so the UI can contrast "cash out early"
// (cycle 1) against "save to the end" (last cycle).
export function positionComparison(raw: ChitPlanInput): WinScenario[] {
  const { cycles } = normalise(raw);
  return Array.from({ length: cycles }, (_, i) => scenarioForWin(raw, i + 1));
}
