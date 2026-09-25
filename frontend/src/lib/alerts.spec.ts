import { describe, it, expect } from "vitest";
import { diffAlerts, type AlertSnapshot } from "./alerts";

const base: AlertSnapshot = {
  state: "Collecting",
  cycle: 1,
  deadline: null,
  nowMs: 1_000_000_000_000,
  address: "GUSER",
  winner: null,
};

const snap = (over: Partial<AlertSnapshot>): AlertSnapshot => ({ ...base, ...over });

describe("diffAlerts", () => {
  it("fires nothing on the first observation (prev=null)", () => {
    expect(diffAlerts(null, snap({ state: "Bidding" }))).toEqual([]);
  });

  it("fires nothing when state is unchanged and no deadline is near", () => {
    expect(diffAlerts(snap({}), snap({}))).toEqual([]);
  });

  it("announces the bidding window on Collecting -> Bidding", () => {
    const a = diffAlerts(snap({ state: "Collecting" }), snap({ state: "Bidding" }));
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe("bid:1");
    expect(a[0].title).toContain("Bidding");
  });

  it("celebrates when the connected user won the payout", () => {
    const a = diffAlerts(
      snap({ state: "Bidding" }),
      snap({ state: "Payout", winner: "GUSER" }),
    );
    expect(a[0].id).toBe("won:1");
    expect(a[0].title).toContain("You won");
  });

  it("gives a neutral payout alert when someone else won", () => {
    const a = diffAlerts(
      snap({ state: "Bidding" }),
      snap({ state: "Payout", winner: "GOTHER" }),
    );
    expect(a[0].id).toBe("payout:1");
  });

  it("warns once inside the final hour of collection", () => {
    const deadline = Math.floor(base.nowMs / 1000) + 1800; // 30 min out
    const a = diffAlerts(snap({ deadline }), snap({ state: "Collecting", deadline }));
    expect(a.some((x) => x.id === "deadlineSoon:1")).toBe(true);
  });

  it("does not warn when the deadline is still far away", () => {
    const deadline = Math.floor(base.nowMs / 1000) + 7200; // 2h out
    const a = diffAlerts(snap({ deadline }), snap({ state: "Collecting", deadline }));
    expect(a).toEqual([]);
  });

  it("announces the close once the deadline passes", () => {
    const deadline = Math.floor(base.nowMs / 1000) - 10; // already past
    const a = diffAlerts(snap({ deadline }), snap({ state: "Collecting", deadline }));
    expect(a.some((x) => x.id === "deadlinePassed:1")).toBe(true);
  });
});
