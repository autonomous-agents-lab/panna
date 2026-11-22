import { join, relative } from "node:path";
import { expect, it } from "vitest";

import { formatHits } from "./find-literal";
import { findRawHexColours } from "./hex-colour";

const repoRoot = join(import.meta.dirname, "..", "..");
const srcRoot = join(repoRoot, "src");

// src/theme/tokens.ts is the one file where colour values may be written; everything else
// uses the `theme` export or the `var(--…)` custom properties generated from it.
const EXCLUDES = ["theme/tokens.ts", "**/__fixtures__/**"];

it("has no raw hex colours anywhere in src/ outside the theme file", () => {
  const hits = findRawHexColours(srcRoot, EXCLUDES).map((hit) => ({
    ...hit,
    path: relative(repoRoot, hit.path),
  }));
  expect(hits, `Use theme tokens / var(--…) instead of raw hex:\n${formatHits(hits)}`).toEqual([]);
});
