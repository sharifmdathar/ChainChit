import { describe, it, expect } from "vitest";
import {
  normalise,
  deriveMetrics,
  cashflowsForWin,
  cumulativeCashflows,
  scenarioForWin,
  positionComparison,
  type ChitPlanInput,
} from "./planner";

// Canonical scenario: 5 members x $100, 5 monthly cycles, 10% typical discount.
const base: ChitPlanInput = {
  members: 5,
  contribution: 100,
  cycles: 5,
  discountPct: 10,
  cycleMonths: 1,
};

describe("normalise", () => {
  it("clamps nonsense into a safe range", () => {
    expect(normalise({ members: 1, contribution: -5, cycles: 0, discountPct: 150, cycleMonths: 0 })).toEqual({
      members: 2,
      contribution: 0,
      cycles: 1,
      discountPct: 99,
      cycleMonths: 1,
    });
  });

  it("treats NaN (empty fields) as defaults", () => {
    const n = normalise({
      members: NaN,
      contribution: NaN,
      cycles: NaN,
      discountPct: NaN,
      cycleMonths: NaN,
    });
    expect(n.members).toBe(2);
    expect(n.contribution).toBe(0);
    expect(n.cycles).toBe(1);
    expect(n.discountPct).toBe(0);
    expect(n.cycleMonths).toBe(1);
  });
});

describe("deriveMetrics", () => {
  it("computes pool, discount, dividend and net contribution", () => {
    const m = deriveMetrics(base);
    expect(m.pool).toBe(500);
    expect(m.discountAmount).toBe(50);
    expect(m.winnerPayout).toBe(450);
    expect(m.dividendPerMember).toBeCloseTo(12.5, 6);
    expect(m.netContribution).toBeCloseTo(87.5, 6);
    expect(m.totalContributed).toBe(500);
    expect(m.runMonths).toBe(5);
  });
});

describe("cashflowsForWin / cumulativeCashflows", () => {
  it("builds the per-cycle net position for a winning cycle", () => {
    // Win cycle 1: +350 in month 1, then -87.5 (net contribution) thereafter.
    expect(cashflowsForWin(base, 1)).toEqual([350, -87.5, -87.5, -87.5, -87.5]);
    expect(cumulativeCashflows(base, 1)).toEqual([350, 262.5, 175, 87.5, 0]);
  });
});

describe("scenarioForWin", () => {
  it("is nominally zero-sum when cycles == members", () => {
    for (let k = 1; k <= base.cycles; k++) {
      expect(scenarioForWin(base, k).netProfit).toBeCloseTo(0, 6);
    }
  });

  it("an early winner needs no out-of-pocket and is cash-positive immediately", () => {
    const s = scenarioForWin(base, 1);
    expect(s.winMonth).toBe(0);
    expect(s.peakFunding).toBe(0);
    expect(s.breakevenCycle).toBe(1);
    expect(s.lump).toBe(450);
    expect(s.dividends).toBeCloseTo(50, 6);
  });

  it("a late winner locks up the most cash and breaks even only at the pot", () => {
    const last = scenarioForWin(base, 5);
    expect(last.winMonth).toBe(4);
    expect(last.peakFunding).toBeCloseTo(350, 6); // four net contributions before the pot
    expect(last.breakevenCycle).toBe(5);

    const mid = scenarioForWin(base, 3);
    expect(mid.peakFunding).toBeCloseTo(175, 6);
    expect(mid.breakevenCycle).toBe(3);
  });

  it("clamps an out-of-range win cycle into the run", () => {
    expect(scenarioForWin(base, 99).winCycle).toBe(5);
    expect(scenarioForWin(base, 0).winCycle).toBe(1);
  });
});

describe("positionComparison", () => {
  it("returns one scenario per cycle with rising funding need and break-even", () => {
    const rows = positionComparison(base);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.winCycle)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].peakFunding).toBeGreaterThanOrEqual(rows[i - 1].peakFunding - 1e-9);
      expect(rows[i].breakevenCycle).toBe(i + 1);
    }
  });
});
