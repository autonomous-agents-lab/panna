import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { envSchema } from "@/config/schema";
import { SERVER_ENV_VARIABLES } from "@/config/server";

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
    const keys = assignments.map((entry) => entry.key ?? "");
    const isPublic = (key: string) => key.startsWith("NEXT_PUBLIC_");
    const serverOnly: readonly string[] = SERVER_ENV_VARIABLES;
    expect(keys.filter(isPublic).sort()).toEqual(Object.keys(envSchema.shape).sort());
    expect(keys.filter((key) => !isPublic(key)).filter((key) => !serverOnly.includes(key))).toEqual([]);
  });

  it("documents every server-only variable, set or in a comment", () => {
    const text = read(".env.example");
    for (const name of SERVER_ENV_VARIABLES) expect(text, name).toMatch(new RegExp(`\\b${name}\\b`));
  });

  it("warns that the test routes must never be turned on in Netlify", () => {
    expect(read(".env.example")).toMatch(/never be set in Netlify/);
    expect(read("README.md")).toMatch(/never be set in Netlify/);
  });

  it("documents each variable with a comment and a valid placeholder", () => {
    const { lines, assignments } = parseEnvExample();
    for (const { key, value, index } of assignments) {
      expect(lines[index - 1], `${key} needs a # comment above it`).toMatch(/^#/);
      expect(value, `${key} needs a placeholder`).not.toBe("");
    }
    expect(() => envSchema.parse(Object.fromEntries(assignments.map((a) => [a.key, a.value])))).not.toThrow();
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
