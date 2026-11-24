import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  IN_MEMORY_STORE_TAG,
  isHostTooling,
  LOCAL_SUPABASE,
  LOCAL_SUPABASE_TAG,
  PREVIEW_TOOLBAR_DOMAINS,
  resolveTarget,
  TEST_ROUTES_TAG,
} from "../../e2e/target";

const repoRoot = join(import.meta.dirname, "..", "..");
const PREVIEW = "https://deploy-preview-7--panna-book.netlify.app";

describe("resolveTarget (AC-3)", () => {
  it("points at a deployed site when PLAYWRIGHT_BASE_URL is set, starting no server and leaving out test-route, in-memory store and local-Supabase tests", () => {
    const target = resolveTarget({ PLAYWRIGHT_BASE_URL: `${PREVIEW}/`, E2E_PORT: "4000" });

    expect(target).toEqual({
      baseURL: PREVIEW,
      grepInvert: new RegExp(`${TEST_ROUTES_TAG}|${IN_MEMORY_STORE_TAG}|${LOCAL_SUPABASE_TAG}`),
      hostToolingDomains: PREVIEW_TOOLBAR_DOMAINS,
      standInWriting: false,
    });
    expect(target.grepInvert?.test("@test-routes")).toBe(true);
    expect(target.grepInvert?.test("the writing dashboard flow @in-memory-store")).toBe(true);
    expect(target.grepInvert?.test("@local-supabase")).toBe(true);
    expect(target.grepInvert?.test("/write is noindex")).toBe(false);
    expect(target.grepInvert?.test("sign-in in en-US")).toBe(false);
  });

  it("otherwise builds and starts the app itself, with test routes and stand-in writing on and auth links back to it", () => {
    expect(resolveTarget({ PLAYWRIGHT_BASE_URL: "", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toEqual({
      baseURL: "http://localhost:3100",
      hostToolingDomains: [],
      standInWriting: true,
      webServer: {
        command: "npm run build && npm run start -- --port 3100",
        url: "http://localhost:3100",
        env: {
          ENABLE_TEST_ROUTES: "true",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
          ENABLE_STAND_IN_WRITING: "true",
          NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE.url,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE.anonKey,
        },
      },
    });
    expect(resolveTarget({ E2E_PORT: "4000" }).webServer?.env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:4000");
  });

  it("with E2E_STAND_IN_WRITING=false, serves /write as a deploy does and leaves out the in-memory store tests", () => {
    const target = resolveTarget({ E2E_STAND_IN_WRITING: "false" });
    expect(target.standInWriting).toBe(false);
    expect(target.webServer?.env.ENABLE_STAND_IN_WRITING).toBe("false");
    expect(target.grepInvert?.test("the writing dashboard flow @in-memory-store")).toBe(true);
    expect(target.grepInvert?.test("/write is noindex")).toBe(false);
    expect(target.grepInvert?.test("@test-routes")).toBe(false);
  });

  it.each(["true", "", "yes"])("with E2E_STAND_IN_WRITING=%j, keeps stand-in writing on", (value) => {
    const target = resolveTarget({ E2E_STAND_IN_WRITING: value });
    expect(target.standInWriting).toBe(true);
    expect(target.webServer?.env.ENABLE_STAND_IN_WRITING).toBe("true");
    expect(target.grepInvert).toBeUndefined();
  });

  it("keeps Supabase values from the environment (e.g. .env.local), filling in only missing ones", () => {
    const env = resolveTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55555", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" })
      .webServer?.env;
    expect(env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55555",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE.anonKey,
    });
  });

  it("falls back to exactly the local values .env.example documents", () => {
    const example = readFileSync(join(repoRoot, ".env.example"), "utf8");
    expect(example).toContain(`\nNEXT_PUBLIC_SUPABASE_URL=${LOCAL_SUPABASE.url}\n`);
    expect(example).toContain(`\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${LOCAL_SUPABASE.anonKey}\n`);
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

  const localOnly =
    /error page|\/test-only\/|writing dashboard flow|with local Supabase|sign-in in |sign-in with the keyboard|Continue with Google/;
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
  ];

  it("leaves out only the tests that need /test-only/* routes, the in-memory store or Supabase, which still run locally", () => {
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
    ]) {
      expect(remote.some((line) => line.includes(name)), name).toBe(true);
    }
  });

  it("still checks /write for noindex and axe violations against a Deploy Preview", () => {
    expect(remote.some((line) => line.includes("/write is noindex"))).toBe(true);
    for (const locale of ["en-US", "hi-IN"]) {
      expect(remote.some((line) => line.includes(`in ${locale} › the writing dashboard page has no axe violations`))).toBe(true);
    }
  });
});
