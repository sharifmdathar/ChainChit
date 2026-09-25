import { describe, it, expect } from "vitest";
import {
  isJoinable,
  spotsLeft,
  poolOf,
  sortCandidates,
  filterDiscoverable,
  type DiscoverCandidate,
} from "./discover";
import type { GroupInfo, GroupState } from "@/types";

function info(over: Partial<GroupInfo> = {}): GroupInfo {
  return {
    admin: "A",
    token: "T",
    reputation_contract: "R",
    identity_contract: "I",
    dispute_contract: "D",
    contribution_amount: 100,
    num_members: 5,
    total_cycles: 5,
    current_cycle: 0,
    state: "Forming" as GroupState,
    min_attestation_score: 0,
    min_reputation_for_bid: 0,
    ...over,
  };
}

function cand(over: Partial<DiscoverCandidate> = {}): DiscoverCandidate {
  return { id: "G1", info: info(), memberCount: 2, isMember: false, ...over };
}

describe("poolOf / spotsLeft", () => {
  it("derives pool size and open seats", () => {
    const c = cand({ info: info({ contribution_amount: 50, num_members: 8 }), memberCount: 3 });
    expect(poolOf(c.info)).toBe(400);
    expect(spotsLeft(c)).toBe(5);
  });

  it("never reports negative seats", () => {
    expect(spotsLeft(cand({ memberCount: 99 }))).toBe(0);
  });
});

describe("isJoinable", () => {
  it("allows open Forming/Collecting groups with seats", () => {
    expect(isJoinable(cand({ info: info({ state: "Forming" }) }))).toBe(true);
    expect(isJoinable(cand({ info: info({ state: "Collecting" }) }))).toBe(true);
  });

  it("rejects full, joined, bidding, paused and completed groups", () => {
    expect(isJoinable(cand({ memberCount: 5 }))).toBe(false); // full
    expect(isJoinable(cand({ isMember: true }))).toBe(false); // already in
    expect(isJoinable(cand({ info: info({ state: "Bidding" }) }))).toBe(false);
    expect(isJoinable(cand({ info: info({ state: "Paused" }) }))).toBe(false);
    expect(isJoinable(cand({ info: info({ state: "Completed" }) }))).toBe(false);
  });
});

describe("sortCandidates", () => {
  it("orders by largest pool, then most seats", () => {
    const small = cand({ id: "small", info: info({ contribution_amount: 10, num_members: 2 }) });
    const big = cand({ id: "big", info: info({ contribution_amount: 100, num_members: 10 }) });
    const same = cand({ id: "aaa", info: big.info, memberCount: 1 });
    const sorted = sortCandidates([small, big, same]);
    expect(sorted.map((c) => c.id)).toEqual(["aaa", "big", "small"]);
  });
});

describe("filterDiscoverable", () => {
  const rows = [
    cand({ id: "open", info: info({ state: "Forming" }) }),
    cand({ id: "full", info: info({ state: "Forming" }), memberCount: 5 }),
    cand({ id: "bid", info: info({ state: "Bidding" }) }),
  ];

  it("'open' keeps only joinable groups", () => {
    expect(filterDiscoverable(rows, "open").map((c) => c.id)).toEqual(["open"]);
  });

  it("'all' keeps everything (sorted by pool)", () => {
    expect(filterDiscoverable(rows, "all")).toHaveLength(3);
  });

  it("'forming' keeps every still-forming group even if full", () => {
    expect(filterDiscoverable(rows, "forming").map((c) => c.id).sort()).toEqual(["full", "open"]);
  });
});
