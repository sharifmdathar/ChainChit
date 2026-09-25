import { describe, it, expect } from "vitest";
import { friendlySorobanError, friendlyError } from "./errors";

describe("friendlySorobanError", () => {
  it("maps a known contract error code", () => {
    expect(friendlySorobanError("Error(Contract, #25)")).toContain("reputation");
    expect(friendlySorobanError("x Error(Contract, #5) y")).toContain("full");
  });

  it("maps hex-formatted contract codes", () => {
    expect(friendlySorobanError("Error(Contract, #0x11)")).toBe(
      "The group isn't in the payout stage.",
    );
  });

  it("recognises common wallet / RPC failure shapes", () => {
    expect(friendlySorobanError("User rejected the transaction")).toContain("cancelled");
    expect(friendlySorobanError("insufficient balance"))
      .toContain("funds");
    expect(friendlySorobanError("Wallet not connected")).toContain("Connect your wallet");
    expect(friendlySorobanError("Transaction timed out")).toContain("confirm in time");
  });

  it("prefers the specific code over generic simulation wording", () => {
    const msg = "Simulation error: Error(Contract, #7)";
    expect(friendlySorobanError(msg)).toContain("already paid");
  });

  it("truncates very long unknown strings but keeps short ones verbatim", () => {
    const long = "z".repeat(300);
    expect(friendlySorobanError(long).length).toBeLessThanOrEqual(120);
    expect(friendlySorobanError("odd but short")).toBe("odd but short");
  });

  it("returns a safe default for empty input", () => {
    expect(friendlySorobanError("  ")).toContain("Something went wrong");
  });
});

describe("friendlyError", () => {
  it("unwraps Error objects, strings, and unknowns", () => {
    expect(friendlyError(new Error("Error(Contract, #8)"))).toContain("already committed");
    expect(friendlyError("Error(Contract, #3)")).toContain("already a member");
    expect(friendlyError({ weird: true })).toContain("Something went wrong");
  });
});
