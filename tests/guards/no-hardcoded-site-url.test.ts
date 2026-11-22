import { join, relative } from "node:path";
import { expect, it } from "vitest";

import { collectSourceFiles, formatHits } from "./find-literal";
import { findUrlLiterals } from "./site-url";

const repoRoot = join(import.meta.dirname, "..", "..");
const srcRoot = join(repoRoot, "src");

// Our own URLs are built from config.siteUrl (NEXT_PUBLIC_SITE_URL), so a custom domain is only
// an env change. src/config holds the one default; unit tests may use sample URLs as inputs.
const EXCLUDES = ["config/**", "**/__fixtures__/**", "**/*.test.ts", "**/*.test.tsx"];

// Exact strings only, each with its reason. Adding one is a deliberate change, justified in its PR.
const ALLOWED: readonly string[] = [];

it("does not hard-code an absolute http(s) URL anywhere in src/ outside src/config", () => {
  const hits = findUrlLiterals(collectSourceFiles(srcRoot, EXCLUDES), ALLOWED).map((hit) => ({
    ...hit,
    path: relative(repoRoot, hit.path),
  }));
  expect(hits, `Use a path with metadataBase / config.siteUrl instead:\n${formatHits(hits)}`).toEqual([]);
});
