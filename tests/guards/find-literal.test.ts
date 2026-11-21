import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { collectSourceFiles, findLiteral, formatHits, globToRegExp } from "./find-literal";

const NAME = "Panna";

describe("findLiteral", () => {
  it("reports the path and 1-based line of each match", () => {
    const files = [{ path: "src/a.tsx", content: "one\n<h1>Panna</h1>\nthree\r\nPanna again" }];
    expect(findLiteral(files, NAME)).toEqual([
      { path: "src/a.tsx", line: 2 },
      { path: "src/a.tsx", line: 4 },
    ]);
  });

  it("returns no hits for a clean file", () => {
    expect(findLiteral([{ path: "src/b.ts", content: "export const x = config.appName;" }], NAME)).toEqual(
      [],
    );
  });

  it.each(["PANNA", "panna", "pAnNa"])("ignores case (%s)", (variant) => {
    expect(findLiteral([{ path: "c.ts", content: `"${variant}"` }], NAME)).toHaveLength(1);
  });

  it.each(["Pannaful", "SuperPanna", "Panna_x", "Panna2"])(
    "does not match inside another word (%s)",
    (word) => {
      expect(findLiteral([{ path: "d.ts", content: word }], NAME)).toEqual([]);
    },
  );

  it("treats regex characters in the name literally", () => {
    expect(findLiteral([{ path: "e.ts", content: "Pa.na" }], "Pa.na")).toHaveLength(1);
    expect(findLiteral([{ path: "e.ts", content: "Paxna" }], "Pa.na")).toEqual([]);
  });
});

describe("formatHits", () => {
  it("lists one path:line per hit", () => {
    expect(
      formatHits([
        { path: "src/a.tsx", line: 2 },
        { path: "src/b.ts", line: 9 },
      ]),
    ).toBe("src/a.tsx:2\nsrc/b.ts:9");
  });
});

describe("globToRegExp", () => {
  it.each([
    ["config/**", "config/defaults.ts", true],
    ["config/**", "app/config/defaults.ts", false],
    ["**/__fixtures__/**", "__fixtures__/a.ts", true],
    ["**/__fixtures__/**", "a/b/__fixtures__/c/d.ts", true],
    ["**/__fixtures__/**", "a/x__fixtures__/d.ts", false],
    ["*.md", "README.md", true],
    ["*.md", "docs/README.md", false],
  ])("%s matches %s: %s", (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });
});

describe("collectSourceFiles", () => {
  const root = join(import.meta.dirname, "__fixtures__", "src");
  const relativePaths = (excludes: string[]) =>
    collectSourceFiles(root, excludes).map((file) => relative(root, file.path).split("\\").join("/"));

  it("walks nested folders", () => {
    expect(relativePaths([])).toEqual(["clean.ts", "config/defaults.ts", "dirty.ts"]);
  });

  it("skips excluded folders and finds the literal in the rest", () => {
    expect(relativePaths(["config/**"])).toEqual(["clean.ts", "dirty.ts"]);
    expect(findLiteral(collectSourceFiles(root, ["config/**"]), NAME)).toEqual([{ path: join(root, "dirty.ts"), line: 3 }]);
  });
});
