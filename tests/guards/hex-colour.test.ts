import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findRawHexColours, HEX_COLOUR } from "./hex-colour";

describe("HEX_COLOUR", () => {
  it.each([
    'const c = "#fff";',
    "const c = '#FFF8';",
    'style={{ color: "#F5EBDC" }}',
    'const c = "#f5ebdc80";',
    "color: #fff;",
    "background: linear-gradient(#abc, var(--color-paper));",
    'box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 1px #000000;',
    '<path fill="#123456" />',
  ])("matches a hex colour in %s", (line) => {
    expect(HEX_COLOUR.test(line)).toBe(true);
  });

  it.each([
    "color: var(--color-paper);",
    "this.#fade = true;",
    "&#123;",
    'const c = "#abcde";',
    'const c = "#ggg";',
    'const c = "#fffffff";',
    'href="#main-content"',
    "$#fff",
  ])("does not match %s", (line) => {
    expect(HEX_COLOUR.test(line)).toBe(false);
  });
});

describe("findRawHexColours", () => {
  const root = join(import.meta.dirname, "__fixtures__", "hex");

  it("reports the path and line of each raw hex colour, skipping excluded files", () => {
    expect(findRawHexColours(root, ["theme/tokens.ts"])).toEqual([
      { path: join(root, "Dirty.tsx"), line: 4 },
      { path: join(root, "dirty.module.css"), line: 3 },
    ]);
  });

  it("reports the theme file too when it is not excluded", () => {
    expect(findRawHexColours(root, [])).toContainEqual({
      path: join(root, "theme", "tokens.ts"),
      line: 3,
    });
  });
});
