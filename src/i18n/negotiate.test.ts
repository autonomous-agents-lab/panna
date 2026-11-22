import { describe, expect, it } from "vitest";

import { MAX_ACCEPT_LANGUAGE_LENGTH, negotiateLocale, parseAcceptLanguage } from "./negotiate";

describe("parseAcceptLanguage", () => {
  it("orders by quality, keeping header order on ties", () => {
    expect(parseAcceptLanguage("fr;q=0.5, hi-IN, en;q=0.8, de;q=0.5")).toEqual([
      { tag: "hi-in", q: 1 },
      { tag: "en", q: 0.8 },
      { tag: "fr", q: 0.5 },
      { tag: "de", q: 0.5 },
    ]);
  });

  it("lower-cases tags and tolerates spaces around the quality", () => {
    expect(parseAcceptLanguage("HI ; q = 0.9")).toEqual([{ tag: "hi", q: 0.9 }]);
  });

  it("drops q=0 and malformed entries", () => {
    expect(
      parseAcceptLanguage("hi;q=0, en;q=1.5, x_y, ;q=0.5, fr;q=abc, de;level=1, es;q=0.000, it;q=1.000, *"),
    ).toEqual([
      { tag: "it", q: 1 },
      { tag: "*", q: 1 },
    ]);
  });

  it.each([undefined, null, ""])("returns nothing for %j", (header) => {
    expect(parseAcceptLanguage(header)).toEqual([]);
  });

  it("only reads the first MAX_ACCEPT_LANGUAGE_LENGTH characters", () => {
    const filler = "en;q=0.1,".repeat(MAX_ACCEPT_LANGUAGE_LENGTH);
    const preferences = parseAcceptLanguage(`${filler}hi`);
    expect(preferences.length).toBeLessThanOrEqual(MAX_ACCEPT_LANGUAGE_LENGTH / 9 + 1);
    expect(preferences.map((p) => p.tag)).not.toContain("hi");
  });
});

describe("negotiateLocale", () => {
  it.each([
    ["hi-IN,hi;q=0.9,en;q=0.8", "hi"],
    ["HI", "hi"],
    ["hi", "hi"],
    ["fr,hi;q=0.8", "hi"],
    ["fr,hi;q=0.8,en;q=0.5", "hi"],
    ["en-US,hi;q=0.5", "en"],
    ["en;q=0.5,hi;q=0.5", "en"],
    ["hi;q=0.5,en;q=0.5", "hi"],
    ["fr", "en"],
    ["fr-FR,de;q=0.9", "en"],
    ["*", "en"],
    ["*,hi;q=0.5", "en"],
    ["hi;q=0,en;q=0.1", "en"],
    ["hi;q=0", "en"],
    ["en;q=0,hi;q=0.2", "hi"],
    ["hi;q=oops", "en"],
    [";;;,,,", "en"],
  ])("%j → %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });

  it.each([undefined, null, ""])("defaults to English for %j", (header) => {
    expect(negotiateLocale(header)).toBe("en");
  });
});
