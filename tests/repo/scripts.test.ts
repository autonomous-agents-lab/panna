import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { envSchema } from "@/config/schema";
import { supabaseEnvSchema } from "@/config/supabase";

const repoRoot = join(import.meta.dirname, "..", "..");
const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

describe("npm scripts", () => {
  const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

  it("runs typecheck, lint and unit tests in order, stopping at the first failure", () => {
    expect(scripts.test).toBe("npm run typecheck && npm run lint && npm run test:unit");
    expect(scripts.typecheck).toBe("tsc --noEmit");
    expect(scripts.lint).toBe("eslint .");
    expect(scripts["test:unit"]).toBe("vitest run");
  });

  it("keeps the stable dev, build and e2e commands", () => {
    expect(scripts.dev).toBe("next dev");
    expect(scripts.build).toBe("next build");
    expect(scripts["test:e2e"]).toBe("playwright test");
  });

  it("runs the database policy tests, the bundle check and type generation through the Supabase CLI", () => {
    expect(scripts["test:db"]).toBe("supabase test db");
    expect(scripts["test:build"]).toBe("next build && vitest run --config vitest.build.config.ts");
    expect(scripts["db:types"]).toBe(
      "supabase gen types typescript --local > src/lib/supabase/database.types.ts",
    );
  });

  it("type-checks in strict mode", () => {
    const tsconfig = JSON.parse(read("tsconfig.json")) as { compilerOptions: { strict?: boolean } };
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });
});

describe("e2e config", () => {
  it("starts its own app server on a port apart from the dev server's", async () => {
    const { default: playwright } = await import("../../playwright.config");
    const webServer = playwright.webServer;
    if (!webServer || Array.isArray(webServer)) throw new Error("expected a single webServer");

    expect(webServer.reuseExistingServer).toBe(false);
    expect(webServer.url).not.toBe("http://localhost:3000");
    expect(webServer.command).toContain(`--port ${new URL(webServer.url ?? "").port}`);
  });
});

describe(".env.example", () => {
  function parseEnvExample() {
    const lines = read(".env.example").split(/\r?\n/);
    const assignments = lines.flatMap((line, index) => {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      return match ? [{ key: match[1], value: match[2], index }] : [];
    });
    return { lines, assignments };
  }

  it("lists exactly the variables src/config reads", () => {
    const { assignments } = parseEnvExample();
    expect(assignments.map((entry) => entry.key).sort()).toEqual(
      [...Object.keys(envSchema.shape), ...Object.keys(supabaseEnvSchema.shape)].sort(),
    );
  });

  it("documents each variable with a comment and a valid placeholder", () => {
    const { lines, assignments } = parseEnvExample();
    for (const { key, value, index } of assignments) {
      expect(lines[index - 1], `${key} needs a # comment above it`).toMatch(/^#/);
      expect(value, `${key} needs a placeholder`).not.toBe("");
    }
    const values = Object.fromEntries(assignments.map((a) => [a.key, a.value]));
    expect(() => envSchema.parse(values)).not.toThrow();
    expect(() => supabaseEnvSchema.parse(values)).not.toThrow();
  });

  it("holds no key-shaped Supabase secret", () => {
    const { assignments } = parseEnvExample();
    for (const { key, value } of assignments) {
      expect(value, `${key} looks like a JWT`).not.toMatch(/^eyJ/);
    }
    expect(read(".env.example")).not.toMatch(/SERVICE_ROLE/);
  });
});

describe("local env files", () => {
  it("are git-ignored", () => {
    const patterns = read(".gitignore").split(/\r?\n/);
    expect(patterns.some((pattern) => pattern === ".env.local" || pattern === ".env*.local")).toBe(
      true,
    );
  });
});

describe("README quick start", () => {
  it("covers install, env setup and running the app", () => {
    const quickStart = read("README.md").split("## Quick start")[1] ?? "";
    expect(quickStart).toContain("nvm use");
    expect(quickStart).toContain("npm ci");
    expect(quickStart).toContain("cp .env.example .env.local");
    expect(quickStart).toContain("npm run dev");
  });
});

describe("local Supabase project", () => {
  it("seeds the database from supabase/seed.sql on db reset", () => {
    const seedSection = read("supabase/config.toml").split("[db.seed]")[1]?.split(/\n\[/)[0] ?? "";
    expect(seedSection).toMatch(/^enabled = true$/m);
    expect(seedSection).toMatch(/^sql_paths = \["\.\/seed\.sql"\]$/m);
    expect(read("supabase/seed.sql")).toContain("insert into public.app_meta");
  });

  it("has timestamped migrations and pgTAP policy tests", () => {
    const migrations = readdirSync(join(repoRoot, "supabase", "migrations"));
    expect(migrations.length).toBeGreaterThan(0);
    for (const file of migrations) expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);

    const tests = readdirSync(join(repoRoot, "supabase", "tests"));
    expect(tests).toEqual(expect.arrayContaining(["app_meta_rls.test.sql", "rls_enabled.test.sql"]));
  });
});

describe("README local Supabase", () => {
  const section = read("README.md").split("## Local Supabase")[1]?.split(/\n## /)[0] ?? "";

  it("covers starting the stack, copying its values and running the policy tests", () => {
    expect(section).toContain("npx supabase start");
    expect(section).toContain("npx supabase status");
    expect(section).toContain(".env.local");
    expect(section).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(section).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(section).toContain("npx supabase db reset");
    expect(section).toContain("npm run test:db");
  });

  it("covers adding a migration and the rules for applied migrations", () => {
    expect(section).toContain("npx supabase migration new");
    expect(section).toContain("npm run db:types");
    expect(section).toMatch(/applied migrations? (is|are) never edited/i);
    expect(section).toMatch(/never drops? user data/i);
  });
});
