import { describe, it, expect } from "vitest";
import { isDeadlineExpired, formatCollectionRemaining } from "./deadline";

describe("isDeadlineExpired", () => {
  const t = 1_000n; // arbitrary epoch seconds
  it("is false for legacy groups with no armed deadline", () => {
    expect(isDeadlineExpired(null, Number(t) * 1000 + 9999)).toBe(false);
  });
  it("is false while the window is still open", () => {
    expect(isDeadlineExpired(Number(t), Number(t) * 1000 - 1)).toBe(false);
  });
  it("is true exactly at and after the deadline", () => {
    expect(isDeadlineExpired(Number(t), Number(t) * 1000)).toBe(true);
    expect(isDeadlineExpired(Number(t), Number(t) * 1000 + 5000)).toBe(true);
  });
});

describe("formatCollectionRemaining", () => {
  it("shows days + hours for long windows", () => {
    expect(formatCollectionRemaining((2 * 86400 + 5 * 3600) * 1000)).toBe("2d 5h");
  });
  it("shows hours + minutes in the final day", () => {
    expect(formatCollectionRemaining((23 * 3600 + 30 * 60) * 1000)).toBe("23h 30m");
  });
  it("shows minutes + seconds in the final hour, bare seconds under a minute", () => {
    expect(formatCollectionRemaining(59 * 1000)).toBe("59s");
    expect(formatCollectionRemaining(60 * 1000)).toBe("1m 0s");
    expect(formatCollectionRemaining(3599 * 1000)).toBe("59m 59s");
  });
  it("never goes negative", () => {
    expect(formatCollectionRemaining(-12345)).toBe("0s");
  });
});
