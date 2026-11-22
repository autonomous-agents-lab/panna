import { join, relative } from "node:path";
import { expect, it } from "vitest";

import { collectSourceFiles } from "./find-literal";
import { findHostSpecificCode } from "./host-specific";

const repoRoot = join(import.meta.dirname, "..", "..");

// Tests are skipped: some stub host variables on purpose, to prove app code ignores them.
const EXCLUDES = ["**/__fixtures__/**", "**/*.test.ts", "**/*.test.tsx"];

it("keeps app code in src/ host-agnostic: no host-specific imports or env variables", () => {
  const hits = findHostSpecificCode(collectSourceFiles(join(repoRoot, "src"), EXCLUDES)).map(
    (hit) => `${relative(repoRoot, hit.path)}:${hit.line} ${hit.match}`,
  );
  expect(hits, "Map host variables onto our own in netlify.toml instead").toEqual([]);
});
