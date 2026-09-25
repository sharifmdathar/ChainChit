import { describe, it, expect } from "vitest";
import {
  shortenAddress,
  formatUsdc,
  getReputationColor,
  getReputationLabel,
  getStateColor,
  u64ToLeBytes,
  computeCommitment,
} from "./utils";

describe("shortenAddress", () => {
  it("keeps head and tail chars", () => {
    expect(shortenAddress("GDJFMVPEBMOYMYHPEHXODG4WLDSTQBD", 6)).toBe("GDJFMV...DSTQBD");
  });
  it("returns empty string for missing address", () => {
    expect(shortenAddress("")).toBe("");
  });
});

describe("formatUsdc", () => {
  it("converts 10^7 base units to $1.00 (UI divides by 1e7)", () => {
    expect(formatUsdc(10_000_000)).toBe("$1.00");
    expect(formatUsdc(25_000_000)).toBe("$2.50");
  });
  it("handles sub-cent amounts without NaN", () => {
    expect(formatUsdc(1)).toBe("$0.00");
  });
  it("renders zero", () => {
    expect(formatUsdc(0)).toBe("$0.00");
  });
});

describe("reputation helpers", () => {
  it("colors: >=800 success, >=500 warning, below danger", () => {
    expect(getReputationColor(950)).toBe("text-chit-success");
    expect(getReputationColor(500)).toBe("text-chit-warning");
    expect(getReputationColor(499)).toBe("text-chit-danger");
  });
  it("labels cover every band including boundaries", () => {
    expect(getReputationLabel(1000)).toBe("Excellent");
    expect(getReputationLabel(900)).toBe("Excellent");
    expect(getReputationLabel(899)).toBe("Good");
    expect(getReputationLabel(699)).toBe("Fair");
    expect(getReputationLabel(499)).toBe("Poor");
    expect(getReputationLabel(0)).toBe("New");
  });
});

describe("getStateColor", () => {
  it("maps every lifecycle state to a distinct badge class", () => {
    const states = ["Forming", "Collecting", "Bidding", "Payout", "Completed", "Paused"];
    const classes = states.map(getStateColor);
    expect(new Set(classes).size).toBe(states.length);
  });
  it("falls back to the neutral class for unknown states", () => {
    expect(getStateColor("Nonsense")).toBe(getStateColor("Completed"));
  });
});

describe("u64ToLeBytes", () => {
  it("encodes little-endian", () => {
    expect(Array.from(u64ToLeBytes(1))).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("encodes 256 with the carry in byte 1", () => {
    expect(Array.from(u64ToLeBytes(256))).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
  });
});

describe("computeCommitment (SHA-256(amount_le || nonce_le))", () => {
  it("produces a 32-byte commitment", async () => {
    const c = await computeCommitment(1_000_000, 42);
    expect(c).toHaveLength(32);
  });
  it("is deterministic for the same amount + nonce", async () => {
    const a = await computeCommitment(1_000_000, 42);
    const b = await computeCommitment(1_000_000, 42);
    expect(a).toEqual(b);
  });
  it("changes when either the amount or the nonce changes", async () => {
    const base = await computeCommitment(1_000_000, 42);
    expect(base).not.toEqual(await computeCommitment(1_000_001, 42));
    expect(base).not.toEqual(await computeCommitment(1_000_000, 43));
  });
});
