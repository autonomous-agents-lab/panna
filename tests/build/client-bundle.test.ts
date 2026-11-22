import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

import { collectSourceFiles } from "../guards/find-literal";
import { findNonPublicSupabaseEnv, findServiceRoleOutsideServerOnly } from "../guards/supabase-env";

const repoRoot = join(import.meta.dirname, "..", "..");
const staticRoot = join(repoRoot, ".next", "static");

it("ships only the public Supabase variables to the browser", () => {
  expect(existsSync(staticRoot), "Run `next build` first (npm run test:build does)").toBe(true);
  const bundles = collectSourceFiles(staticRoot, []).filter((file) => file.path.endsWith(".js"));
  expect(bundles.length).toBeGreaterThan(0);

  const hits = findNonPublicSupabaseEnv(bundles).map((hit) => ({ ...hit, path: relative(repoRoot, hit.path) }));
  expect(hits).toEqual([]);
  // No bundled file may be guarded by server-only, so any mention at all is a leak.
  expect(findServiceRoleOutsideServerOnly(bundles).map((path) => relative(repoRoot, path))).toEqual([]);
});
