import { describe, it, expect } from "vitest";
import jsQR from "jsqr";
import { generateQr } from "./qr";

// Encode with our generator, rasterise with a quiet zone, and decode with
// jsQR (ZXing port) — an independent reference implementation. If a scanned
// phone reads these, this test passes; if it fails, scanners will fail too.
function roundtrip(value: string): string | null {
  const modules = generateQr(value);
  const dim = modules.length;
  const scale = 4;
  const quiet = 8; // modules (2x the spec minimum, helps the locator)
  const size = (dim + quiet * 2) * scale;
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      if (!modules[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        let idx = ((r + quiet) * scale + dy) * size + (c + quiet) * scale;
        for (let dx = 0; dx < scale; dx++, idx++) {
          rgba[idx * 4] = 0;
          rgba[idx * 4 + 1] = 0;
          rgba[idx * 4 + 2] = 0;
        }
      }
    }
  }
  const result = jsQR(rgba, size, size);
  return result?.data ?? null;
}

describe("generateQr roundtrip (decoded by jsQR reference impl)", () => {
  it("encodes a short URL (version 1-2)", () => {
    expect(roundtrip("https://chainchit.app/")).toBe("https://chainchit.app/");
  });
  it("encodes a realistic invite deep link (version 4+)", () => {
    const url =
      "https://chainchit.vercel.app/group/CAYOIBPQO4QK6Q3YD4OYDMFRV4BLFZMQ3NVFUB522VHVC62ZPT5OXUBB?join=1";
    expect(roundtrip(url)).toBe(url);
  });
  it("encodes a multi-block version (>= v5, 2 blocks)", () => {
    const long = "chainchit:".repeat(12); // 120 chars -> v5
    expect(roundtrip(long)).toBe(long);
  });
  it("produces a square matrix of valid size", () => {
    const m = generateQr("HELLO");
    expect(m.length).toBe(21);
    expect(m.every((row) => row.length === 21)).toBe(true);
  });
});
