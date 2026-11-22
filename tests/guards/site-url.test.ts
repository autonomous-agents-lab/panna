import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { collectSourceFiles } from "./find-literal";
import { findUrlLiterals } from "./site-url";

const SVG = "http://www.w3.org/2000/svg";

describe("findUrlLiterals", () => {
  it("reports the line of each http or https URL", () => {
    const files = [{ path: "a.ts", content: 'one\nconst u = "https://example.org/x";\n`http://localhost:3000`' }];
    expect(findUrlLiterals(files, [])).toEqual([
      { path: "a.ts", line: 2 },
      { path: "a.ts", line: 3 },
    ]);
  });

  it("allows only exact allowlisted strings", () => {
    expect(findUrlLiterals([{ path: "b.ts", content: `"${SVG}"` }], [SVG])).toEqual([]);
    expect(findUrlLiterals([{ path: "b.ts", content: `"${SVG}/extra"` }], [SVG])).toHaveLength(1);
    expect(findUrlLiterals([{ path: "b.ts", content: `"${SVG}" "https://example.org"` }], [SVG])).toHaveLength(1);
  });

  it("ignores relative paths and other schemes", () => {
    expect(findUrlLiterals([{ path: "c.ts", content: 'href="/" mailto:a@b.c ftp://x' }], [])).toEqual([]);
  });

  it("catches a URL planted in a fixture file", () => {
    const root = join(import.meta.dirname, "__fixtures__", "url");
    expect(findUrlLiterals(collectSourceFiles(root, []), [SVG])).toEqual([{ path: join(root, "dirty.ts"), line: 3 }]);
  });
});
