import { describe, it, expect } from "vitest";
import {
  NATIVE_TOKEN_ADDRESS,
  assetOf,
  assetSymbol,
  formatAmount,
} from "./asset";

const USDC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

describe("asset helpers", () => {
  it("detects native XLM (case-insensitive) and defaults to USDC", () => {
    expect(assetOf(NATIVE_TOKEN_ADDRESS)).toBe("XLM");
    expect(assetOf(NATIVE_TOKEN_ADDRESS.toLowerCase())).toBe("XLM");
    expect(assetOf(USDC)).toBe("USDC");
    expect(assetOf(undefined)).toBe("USDC");
    expect(assetOf(null)).toBe("USDC");
    expect(assetSymbol(NATIVE_TOKEN_ADDRESS)).toBe("XLM");
  });

  it("formats USDC as currency and XLM with a trailing symbol", () => {
    // 2.5 USDC -> "$2.50"
    expect(formatAmount(25_000_000, USDC)).toBe("$2.50");
    // 2.5 XLM -> "2.50 XLM"
    expect(formatAmount(25_000_000, NATIVE_TOKEN_ADDRESS)).toBe("2.50 XLM");
    // unknown/legacy tokens fall back to the USDC path
    expect(formatAmount(100_000_000, undefined)).toBe("$10.00");
  });
});
