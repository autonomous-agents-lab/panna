import { join, relative } from "node:path";
import { expect, it } from "vitest";

import { DEFAULT_APP_NAME } from "@/config/defaults";

import { collectSourceFiles, findLiteral, formatHits } from "./find-literal";

const repoRoot = join(import.meta.dirname, "..", "..");
const srcRoot = join(repoRoot, "src");

// src/config is the one place the default name may be written. Matching is whole-word and
// case-insensitive, so a name glued to other text (e.g. "PannaBook") is not caught. The
// Devanagari word is not scanned: it is the ordinary Hindi word for "page".
const EXCLUDES = ["config/**", "**/__fixtures__/**"];

it("does not hard-code the app name anywhere in src/ outside src/config", () => {
  const hits = findLiteral(collectSourceFiles(srcRoot, EXCLUDES), DEFAULT_APP_NAME).map(
    (hit) => ({ ...hit, path: relative(repoRoot, hit.path) }),
  );
  expect(hits, `Use config.appName instead of the literal name:\n${formatHits(hits)}`).toEqual([]);
});
