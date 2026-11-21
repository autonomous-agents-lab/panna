import { describe, expect, it } from "vitest";

import { findNonPublicSupabaseEnv, findServiceRoleOutsideServerOnly, isServerOnly } from "./supabase-env";

const file = (path: string, content: string) => ({ path, content });

describe("findNonPublicSupabaseEnv", () => {
  it("allows the two public variables", () => {
    const files = [file("a.js", 'e.NEXT_PUBLIC_SUPABASE_URL,e.NEXT_PUBLIC_SUPABASE_ANON_KEY')];
    expect(findNonPublicSupabaseEnv(files)).toEqual([]);
  });

  it("reports any other upper-case Supabase name once per file", () => {
    const files = [
      file("a.js", "SUPABASE_SERVICE_ROLE_KEY;SUPABASE_SERVICE_ROLE_KEY;NEXT_PUBLIC_SUPABASE_URL"),
      file("b.js", "x=process.env.SUPABASE_DB_PASSWORD"),
    ];
    expect(findNonPublicSupabaseEnv(files)).toEqual([
      { path: "a.js", name: "SUPABASE_SERVICE_ROLE_KEY" },
      { path: "b.js", name: "SUPABASE_DB_PASSWORD" },
    ]);
  });

  it("ignores mixed-case identifiers and names glued to other words", () => {
    const files = [file("a.ts", "createSupabaseBrowserClient(); xNEXT_PUBLIC_SUPABASE_URL; @supabase/ssr")];
    expect(findNonPublicSupabaseEnv(files)).toEqual([]);
  });
});

describe("isServerOnly", () => {
  it.each([
    ['import "server-only";\nconst a = 1;'],
    ["import 'server-only'\n"],
    ['// privileged\n/* admin client */\nimport "server-only";'],
  ])("accepts a module that starts with the server-only import: %j", (content) => {
    expect(isServerOnly(file("a.ts", content))).toBe(true);
  });

  it.each([
    ['const a = 1;\nimport "server-only";'],
    ['import "client-only";'],
    [""],
  ])("rejects a module without a leading server-only import: %j", (content) => {
    expect(isServerOnly(file("a.ts", content))).toBe(false);
  });
});

describe("findServiceRoleOutsideServerOnly", () => {
  it("reports files that mention the service-role key name without server-only", () => {
    const files = [
      file("leak.ts", "process.env.SUPABASE_SERVICE_ROLE_KEY"),
      file("admin.ts", 'import "server-only";\nprocess.env.SUPABASE_SERVICE_ROLE_KEY'),
      file("clean.ts", "process.env.NEXT_PUBLIC_SUPABASE_URL"),
    ];
    expect(findServiceRoleOutsideServerOnly(files)).toEqual(["leak.ts"]);
  });
});
