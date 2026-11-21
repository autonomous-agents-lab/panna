import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const appDir = join(import.meta.dirname, "..", "..", "src", "app");
const read = (file: string) => readFileSync(join(appDir, file), "utf8");
const compact = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");

it("applies the Devanagari font token to Hindi and the Latin token to English", () => {
  const css = compact(read("globals.css"));
  expect(css).toContain(":lang(hi){font-family:var(--font-devanagari);}");
  expect(css).toContain(":lang(en){font-family:var(--font-latin);}");
});

it("self-hosts both UI fonts through next/font with display: swap", () => {
  const fonts = read("fonts.ts");
  expect(fonts).toMatch(/from "next\/font\/google"/);
  const calls = [...fonts.matchAll(/(Noto_Serif(?:_Devanagari)?)\(\{([^}]*)\}\)/g)];
  expect(calls.map(([, family]) => family)).toEqual(["Noto_Serif", "Noto_Serif_Devanagari"]);
  for (const [, , options] of calls) expect(options).toMatch(/display: "swap"/);
  expect(fonts).toMatch(/variable: "--font-face-latin"/);
  expect(fonts).toMatch(/variable: "--font-face-devanagari"/);
});
