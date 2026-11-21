import { join, relative } from "node:path";
import { expect, it } from "vitest";

import { collectSourceFiles } from "./find-literal";
import { findNonPublicSupabaseEnv, findServiceRoleOutsideServerOnly, isServerOnly } from "./supabase-env";

const repoRoot = join(import.meta.dirname, "..", "..");
const srcFiles = collectSourceFiles(join(repoRoot, "src"), ["**/__fixtures__/**"]);
const rel = (path: string) => relative(repoRoot, path);

it("keeps the service-role key name out of src/ except in server-only modules", () => {
  const leaks = findServiceRoleOutsideServerOnly(srcFiles).map(rel);
  expect(leaks, 'Add `import "server-only"` as the first line, or remove the key').toEqual([]);
});

it("references only the public Supabase variables outside server-only modules", () => {
  const hits = findNonPublicSupabaseEnv(srcFiles.filter((file) => !isServerOnly(file))).map((hit) => ({
    ...hit,
    path: rel(hit.path),
  }));
  expect(hits).toEqual([]);
});
