import { describe, expect, it } from "vitest";

import { contrastRatio, hexToRgb, relativeLuminance, toCssRgb } from "@/theme";

// These inputs are literal hex values, which the guard forbids inside src/, so they live here.

describe("hexToRgb", () => {
  it("parses 6-digit hex in either case", () => {
    expect(hexToRgb("#F5EBDC")).toEqual({ r: 245, g: 235, b: 220 });
    expect(hexToRgb("#f5ebdc")).toEqual({ r: 245, g: 235, b: 220 });
  });

  it("expands 3-digit hex", () => {
    expect(hexToRgb("#fa0")).toEqual({ r: 255, g: 170, b: 0 });
  });

  it.each(["fff", "#ffff", "#ffffff80", "#ggg", "#fffff", "", "red"])("rejects %j", (input) => {
    expect(() => hexToRgb(input)).toThrow(/hex colour/);
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
  });

  it("uses the linear segment for very dark channels", () => {
    expect(relativeLuminance({ r: 10, g: 10, b: 10 })).toBeCloseTo(10 / 255 / 12.92, 10);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 10);
  });

  it("is 1 for identical colours", () => {
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#2B2118", "#F5EBDC")).toBe(contrastRatio("#F5EBDC", "#2B2118"));
  });

  it("matches the published value for mid grey on white", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("throws on malformed input", () => {
    expect(() => contrastRatio("#000", "white")).toThrow();
  });
});

describe("toCssRgb", () => {
  it("formats a colour the way browsers report computed styles", () => {
    expect(toCssRgb("#F5EBDC")).toBe("rgb(245, 235, 220)");
    expect(toCssRgb("#000")).toBe("rgb(0, 0, 0)");
  });
});
