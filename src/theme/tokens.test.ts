import { describe, expect, expectTypeOf, it } from "vitest";

import { cssVar, hexToRgb, renderRootCss, theme, toCssVariables } from "@/theme";

describe("theme tokens", () => {
  it.each(["paper", "paperAged", "paperShade", "ink", "accent", "onAccent", "focus", "error"])(
    "has an opaque hex colour for %s",
    (key) => {
      expect(theme.color).toHaveProperty(key);
      const value = theme.color[key as keyof typeof theme.color];
      expect(() => hexToRgb(value)).not.toThrow();
    },
  );

  it("has every colour as an opaque hex value", () => {
    for (const value of Object.values(theme.color)) expect(() => hexToRgb(value)).not.toThrow();
  });

  it.each(["space", "radius", "font", "focus"] as const)("has non-empty %s tokens", (group) => {
    const values = Object.values(theme[group]);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value).not.toBe("");
  });

  it.each(Object.entries(theme.font))("gives the %s stack a Devanagari-capable fallback", (_, stack) => {
    expect(stack).toMatch(/Devanagari/);
  });

  it("leads the script stacks with the self-hosted next/font faces", () => {
    expect(theme.font.devanagari.startsWith("var(--font-face-devanagari,")).toBe(true);
    expect(theme.font.latin.startsWith("var(--font-face-latin,")).toBe(true);
    expect(theme.font.latin).toContain("var(--font-face-devanagari,");
  });

  it("does not use flat white for any paper tone", () => {
    for (const paper of [theme.color.paper, theme.color.paperAged, theme.color.paperShade]) {
      expect(hexToRgb(paper)).not.toEqual({ r: 255, g: 255, b: 255 });
    }
  });

  it("types tokens as literals, not plain strings", () => {
    expectTypeOf(theme.color.paper).toExtend<string>();
    expectTypeOf(theme.color.paper).not.toEqualTypeOf<string>();
    expectTypeOf(theme.space[4]).not.toEqualTypeOf<string>();
  });
});

describe("theme as CSS custom properties", () => {
  const variables = toCssVariables(theme);

  it("has one custom property per token, with the same value", () => {
    const groups = Object.entries(theme) as [string, Record<string, string>][];
    const expected = groups.flatMap(([, tokens]) => Object.values(tokens));
    expect(Object.values(variables).sort()).toEqual(expected.sort());
    expect(variables["--color-paper"]).toBe(theme.color.paper);
    expect(variables["--color-paper-aged"]).toBe(theme.color.paperAged);
    expect(variables["--color-on-accent"]).toBe(theme.color.onAccent);
    expect(variables["--space-4"]).toBe(theme.space[4]);
    expect(variables["--radius-md"]).toBe(theme.radius.md);
    expect(variables["--font-devanagari"]).toBe(theme.font.devanagari);
    expect(variables["--focus-ring-width"]).toBe(theme.focus.ringWidth);
    expect(variables["--focus-ring-offset"]).toBe(theme.focus.ringOffset);
  });

  it("renders them on :root", () => {
    const css = renderRootCss(theme);
    expect(css.startsWith(":root{")).toBe(true);
    expect(css.endsWith("}")).toBe(true);
    for (const [name, value] of Object.entries(variables)) {
      expect(css).toContain(`${name}:${value};`);
    }
  });

  it("references tokens through typed var() helpers", () => {
    expect(cssVar("color.ink")).toBe("var(--color-ink)");
    expect(cssVar("focus.ringOffset")).toBe("var(--focus-ring-offset)");
    expect(variables).toHaveProperty(cssVar("space.16").slice(4, -1));
    // @ts-expect-error unknown token paths do not compile
    cssVar("color.unknown");
    // @ts-expect-error a group is not a token
    cssVar("color");
  });
});
