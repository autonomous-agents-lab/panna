import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isHostTooling, PREVIEW_TOOLBAR_DOMAINS, resolveTarget, TEST_ROUTES_TAG } from "../../e2e/target";

const repoRoot = join(import.meta.dirname, "..", "..");
const PREVIEW = "https://deploy-preview-7--panna-book.netlify.app";

describe("resolveTarget (AC-3)", () => {
  it("points at a deployed site when PLAYWRIGHT_BASE_URL is set, starting no server and leaving out test-route tests", () => {
    const target = resolveTarget({ PLAYWRIGHT_BASE_URL: `${PREVIEW}/`, E2E_PORT: "4000" });

    expect(target).toEqual({
      baseURL: PREVIEW,
      grepInvert: new RegExp(TEST_ROUTES_TAG),
      hostToolingDomains: PREVIEW_TOOLBAR_DOMAINS,
    });
    expect(target.grepInvert?.test("@test-routes")).toBe(true);
  });

  it("otherwise builds and starts the app itself, with test routes on", () => {
    expect(resolveTarget({ PLAYWRIGHT_BASE_URL: "" })).toEqual({
      baseURL: "http://localhost:3100",
      hostToolingDomains: [],
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

describe("isHostTooling (AC-3)", () => {
  const remote = resolveTarget({ PLAYWRIGHT_BASE_URL: PREVIEW });

  it.each([
    "https://netlify-cdp-loader.netlify.app/netlify.js",
    "https://app.netlify.com/access-control/bb-api/api/v1/cdp/deploys/1/views",
    "https://cdn.segment.com/analytics-next/bundles/ajs-destination.bundle.js",
    "https://api.segment.io/v1/t",
    "https://netlify.com/",
  ])("treats the preview toolbar's %s as host tooling on a remote run", (url) => {
    expect(isHostTooling(url, remote)).toBe(true);
  });

  it.each([
    `${PREVIEW}/_next/static/media/devanagari.woff2`,
    "https://fonts.gstatic.com/s/notosansdevanagari.woff2",
    "https://netlify.app.example.com/x.js",
    "https://notsegment.com/x.js",
  ])("never treats %s as host tooling, so the app's own requests still count", (url) => {
    expect(isHostTooling(url, remote)).toBe(false);
  });

  it("treats nothing as host tooling on a local run", () => {
    expect(isHostTooling("https://app.netlify.com/x", resolveTarget({}))).toBe(false);
  });
});

describe("e2e specs", () => {
  const specs = readdirSync(join(repoRoot, "e2e")).filter((file) => file.endsWith(".spec.ts"));

  it.each(specs)("%s takes `test` from ./fixtures, so the preview toolbar is stubbed out", (file) => {
    const source = readFileSync(join(repoRoot, "e2e", file), "utf8");
    expect(source).toMatch(/^import \{ expect, test \} from "\.\/fixtures";$/m);
    expect(source).not.toMatch(/import \{[^}]*\btest\b[^}]*\} from "@playwright\/test"/);
  });
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
