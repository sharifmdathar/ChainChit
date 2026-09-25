import { describe, it, expect } from "vitest";
import { translate, EN, HI } from "./i18n";

describe("translate", () => {
  it("returns the string for the active locale", () => {
    expect(translate("en", "nav.dashboard")).toBe("Dashboard");
    expect(translate("hi", "nav.dashboard")).toBe("डैशबोर्ड");
  });

  it("interpolates {var} placeholders", () => {
    expect(translate("en", "common.cycle", { n: 3 })).toBe("Cycle 3");
    expect(translate("hi", "common.cycle", { n: 3 })).toBe("चक्र 3");
  });

  it("leaves unknown placeholders intact rather than blanking them", () => {
    expect(translate("en", "common.cycle", {})).toBe("Cycle {n}");
  });

  it("falls back to the raw key for unknown keys", () => {
    expect(translate("hi", "totally.missing.key")).toBe("totally.missing.key");
  });
});

describe("dictionaries", () => {
  it("translates every English key into Hindi", () => {
    const missing = Object.keys(EN).filter((k) => !(k in HI));
    expect(missing).toEqual([]);
  });

  it("has no Hindi keys that English lacks", () => {
    const orphan = Object.keys(HI).filter((k) => !(k in EN));
    expect(orphan).toEqual([]);
  });
});
