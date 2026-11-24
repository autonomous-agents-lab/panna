import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  isHostTooling,
  LOCAL_SUPABASE_TAG,
  PREVIEW_TOOLBAR_DOMAINS,
  resolveTarget,
  TEST_ROUTES_TAG,
} from "../../e2e/target";

const repoRoot = join(import.meta.dirname, "..", "..");
const PREVIEW = "https://deploy-preview-7--panna-book.netlify.app";

describe("resolveTarget (AC-3)", () => {
  it("points at a deployed site when PLAYWRIGHT_BASE_URL is set, starting no server and leaving out test-route and local-Supabase tests", () => {
    const target = resolveTarget({ PLAYWRIGHT_BASE_URL: `${PREVIEW}/`, E2E_PORT: "4000" });

    expect(target).toEqual({
      baseURL: PREVIEW,
      grepInvert: new RegExp(`${TEST_ROUTES_TAG}|${LOCAL_SUPABASE_TAG}`),
      hostToolingDomains: PREVIEW_TOOLBAR_DOMAINS,
    });
    expect(target.grepInvert?.test("@test-routes")).toBe(true);
    expect(target.grepInvert?.test("@local-supabase")).toBe(true);
    expect(target.grepInvert?.test("sign-in in en-US")).toBe(false);
  });

  it("otherwise builds and starts the app itself, with test routes on and auth links back to it", () => {
    expect(resolveTarget({ PLAYWRIGHT_BASE_URL: "", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toEqual({
      baseURL: "http://localhost:3100",
      hostToolingDomains: [],
      webServer: {
        command: "npm run build && npm run start -- --port 3100",
        url: "http://localhost:3100",
        env: { ENABLE_TEST_ROUTES: "true", NEXT_PUBLIC_SITE_URL: "http://localhost:3100" },
      },
    });
    expect(resolveTarget({ E2E_PORT: "4000" }).webServer?.env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:4000");
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

  const localOnly = /error page|\/test-only\/|with local Supabase|sign-in in |sign-in with the keyboard|Continue with Google/;
  const needsSupabase = [
    "sign-in in en-US › /login is a translated, noindex page",
    "sign-in in en-US › an invalid email shows an inline, labelled error",
    "sign-in in en-US › a failed or expired link lands on /login",
    "sign-in in hi-IN › /login is a translated, noindex page",
    "sign-in in hi-IN › an invalid email shows an inline, labelled error",
    "sign-in in hi-IN › a failed or expired link lands on /login",
    "sign-in with the keyboard › every control on /login",
    "Continue with Google goes to Supabase's Google flow",
    "with local Supabase › a magic link signs in",
    "onboarding with local Supabase › a new user signs up, claims a username",
    "onboarding with local Supabase › a name claimed by someone else",
    "onboarding with local Supabase › the form works by keyboard alone",
    "onboarding in Hindi with local Supabase › errors are shown inline in Hindi",
  ];

  it("leaves out only the tests that need /test-only/* routes or Supabase, which still run locally", () => {
    const left = local.filter((line) => !remote.includes(line));
    expect(left.length).toBeGreaterThan(0);
    for (const line of left) expect(line).toMatch(localOnly);
    expect(remote.some((line) => localOnly.test(line))).toBe(false);
  });

  it("runs every sign-in test locally but not against the preview, which has no Supabase on purpose (BOOK-17)", () => {
    for (const name of needsSupabase) {
      expect(local.some((line) => line.includes(name)), `local: ${name}`).toBe(true);
      expect(remote.some((line) => line.includes(name)), `remote: ${name}`).toBe(false);
    }
  });

  it("still checks the protected-page redirects against the preview, since they need no Supabase (BOOK-17)", () => {
    for (const name of [
      "protected pages › a signed-out visit to /settings goes to /login",
      "protected pages › a signed-out visit to /onboarding goes to /login",
      "an unknown book in en-US (AC-7) › /no_such_writer_e2e is a localised 404",
      "an unknown book in hi-IN (AC-7) › /not-a-username is a localised 404",
    ]) {
      expect(remote.some((line) => line.includes(name)), name).toBe(true);
    }
  });
});
