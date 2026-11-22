import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import packageJson from "../../package.json";

import { loadServerConfig } from "./server";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("loadServerConfig", () => {
  it("falls back to the package version and keeps test routes off when nothing is set", () => {
    expect(loadServerConfig({})).toEqual({ version: packageJson.version, testRoutes: false });
  });

  it.each([
    ["APP_VERSION", { APP_VERSION: "abc1234", COMMIT_REF: SHA, GITHUB_SHA: SHA }, "abc1234"],
    ["COMMIT_REF", { COMMIT_REF: SHA, GITHUB_SHA: "fedcba9" }, SHA],
    ["GITHUB_SHA", { GITHUB_SHA: "FEDCBA9" }, "FEDCBA9"],
  ])("uses %s as the version, in that order of precedence", (_name, raw, expected) => {
    expect(loadServerConfig(raw, "1.0.0").version).toBe(expected);
  });

  it.each(["", "abc123", "x".repeat(7), `${SHA}0`, "secret-token-value", "abc1234; rm"])(
    "never echoes %j, which is not a commit SHA",
    (value) => {
      expect(loadServerConfig({ APP_VERSION: value }, "1.0.0").version).toBe("1.0.0");
    },
  );

  it("skips an invalid value in favour of the next valid one", () => {
    expect(loadServerConfig({ APP_VERSION: "not a sha", COMMIT_REF: "abc1234" }, "1.0.0").version).toBe("abc1234");
  });

  it("trims whitespace around a SHA", () => {
    expect(loadServerConfig({ GITHUB_SHA: " abc1234\n" }, "1.0.0").version).toBe("abc1234");
  });

  it.each([
    ["true", true],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["", false],
  ])("turns test routes on only for ENABLE_TEST_ROUTES=%j", (value, expected) => {
    expect(loadServerConfig({ ENABLE_TEST_ROUTES: value }).testRoutes).toBe(expected);
  });
});

describe("serverConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads the version and test-route flag from process.env", async () => {
    vi.stubEnv("APP_VERSION", "");
    vi.stubEnv("COMMIT_REF", "abcdef1");
    vi.stubEnv("GITHUB_SHA", "");
    vi.stubEnv("ENABLE_TEST_ROUTES", "true");
    vi.resetModules();

    const { serverConfig } = await import("./server");

    expect(serverConfig).toEqual({ version: "abcdef1", testRoutes: true });
  });

  it("is marked server-only, so importing it from a client component fails the build", () => {
    const source = readFileSync(join(import.meta.dirname, "server.ts"), "utf8");
    expect(source.startsWith('import "server-only";')).toBe(true);
  });
});
