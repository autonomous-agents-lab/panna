import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveTarget, TEST_ROUTES_TAG } from "../../e2e/target";

const repoRoot = join(import.meta.dirname, "..", "..");
const PREVIEW = "https://deploy-preview-7--panna-book.netlify.app";

describe("resolveTarget (AC-3)", () => {
  it("points at a deployed site when PLAYWRIGHT_BASE_URL is set, starting no server and leaving out test-route tests", () => {
    const target = resolveTarget({ PLAYWRIGHT_BASE_URL: `${PREVIEW}/`, E2E_PORT: "4000" });

    expect(target).toEqual({ baseURL: PREVIEW, grepInvert: new RegExp(TEST_ROUTES_TAG) });
    expect(target.grepInvert?.test("@test-routes")).toBe(true);
  });

  it("otherwise builds and starts the app itself, with test routes on", () => {
    expect(resolveTarget({ PLAYWRIGHT_BASE_URL: "" })).toEqual({
      baseURL: "http://localhost:3100",
      webServer: {
        command: "npm run build && npm run start -- --port 3100",
        url: "http://localhost:3100",
        env: { ENABLE_TEST_ROUTES: "true" },
      },
    });
    expect(resolveTarget({ E2E_PORT: "4000" }).webServer?.url).toBe("http://localhost:4000");
  });

  it.each(["deploy-preview-7", "http://panna-book.netlify.app", "ftp://example.com"])(
    "rejects %j, which is not an absolute https URL",
    (value) => {
      expect(() => resolveTarget({ PLAYWRIGHT_BASE_URL: value })).toThrow(
        `PLAYWRIGHT_BASE_URL must be an absolute https URL, got ${JSON.stringify(value)}`,
      );
    },
  );
});

describe("tests run against a Deploy Preview (AC-3, AC-9)", () => {
  const list = (env: Record<string, string>) =>
    execFileSync(process.execPath, [join(repoRoot, "node_modules/@playwright/test/cli.js"), "test", "--list"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, CI: "", ...env },
    })
      .split("\n")
      .filter((line) => line.includes(".spec.ts"));

  const remote = list({ PLAYWRIGHT_BASE_URL: PREVIEW });
  const local = list({ PLAYWRIGHT_BASE_URL: "" });

  it("runs the home, 404 and Coming soon axe checks, the phone-width check and the health check", () => {
    for (const locale of ["en-US", "hi-IN"]) {
      for (const name of ["the home page has no axe violations", "the 404 page has no axe violations"]) {
        expect(remote.some((line) => line.includes(`in ${locale} › ${name}`)), `${locale} ${name}`).toBe(true);
      }
      const comingSoon = remote.filter((line) => line.includes(`Coming soon home page in ${locale}`));
      expect(comingSoon.some((line) => line.endsWith("has no axe violations"))).toBe(true);
      expect(comingSoon.some((line) => line.endsWith("does not scroll sideways"))).toBe(true);
    }
    expect(remote.some((line) => line.includes("/api/health reports ok"))).toBe(true);
  });

  it("leaves out only the tests that need /test-only/* routes, which still run locally", () => {
    const left = local.filter((line) => !remote.includes(line));
    expect(left.length).toBeGreaterThan(0);
    for (const line of left) expect(line).toMatch(/error page|\/test-only\//);
    expect(remote.some((line) => /error page|\/test-only\//.test(line))).toBe(false);
  });
});
