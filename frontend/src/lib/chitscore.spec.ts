import { describe, it, expect } from "vitest";
import { tierForScore, buildChitScoreSvg, type ChitScoreInput } from "./chitscore";

const input: ChitScoreInput = {
  address: "GABCDEF1234567890",
  score: 850,
  onTimePct: 97.5,
  cyclesCompleted: 12,
  bidsWon: 4,
};

describe("tierForScore", () => {
  it("maps score bands to tiers", () => {
    expect(tierForScore(950).name).toBe("Gold");
    expect(tierForScore(800).name).toBe("Silver");
    expect(tierForScore(600).name).toBe("Bronze");
    expect(tierForScore(120).name).toBe("Rising");
  });
});

describe("buildChitScoreSvg", () => {
  it("produces a well-formed standalone SVG", () => {
    const svg = buildChitScoreSvg(input);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("embeds the score, stats and address", () => {
    const svg = buildChitScoreSvg(input);
    expect(svg).toContain(">850<");
    expect(svg).toContain("97.5%");
    expect(svg).toContain("GABCDEF1234567890");
  });

  it("escapes angle brackets in the address to keep the SVG valid", () => {
    const svg = buildChitScoreSvg({ ...input, address: "G<A>&B" });
    expect(svg).toContain("G&lt;A&gt;&amp;B");
    expect(svg).not.toContain("G<A>");
  });

  it("clamps out-of-range scores into the 0..1000 display", () => {
    expect(buildChitScoreSvg({ ...input, score: 2500 })).toContain(">1000<");
    expect(buildChitScoreSvg({ ...input, score: -50 })).toContain(">0<");
  });
});
