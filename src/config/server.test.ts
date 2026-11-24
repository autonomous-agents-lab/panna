import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import packageJson from "../../package.json";

import { loadServerConfig } from "./server";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("loadServerConfig", () => {
  it("falls back to the package version and keeps test routes and stand-in writing off when nothing is set", () => {
    expect(loadServerConfig({})).toEqual({
      version: packageJson.version,
      testRoutes: false,
      writingDataSource: "stand-in",
      standInWriting: false,
    });
  });

  it.each([
    ["production", false],
    ["development", true],
    ["test", true],
    [undefined, false],
  ])("with ENABLE_STAND_IN_WRITING unset and NODE_ENV=%j, serves stand-in writing: %s", (nodeEnv, expected) => {
    expect(loadServerConfig({ NODE_ENV: nodeEnv }).standInWriting).toBe(expected);
  });

  it.each([
    ["true", "production", true],
    ["false", "development", false],
    ["false", "test", false],
  ])("ENABLE_STAND_IN_WRITING=%s wins over NODE_ENV=%s", (value, nodeEnv, expected) => {
    expect(loadServerConfig({ ENABLE_STAND_IN_WRITING: value, NODE_ENV: nodeEnv }).standInWriting).toBe(expected);
  });

  it.each(["", "TRUE", "1", "yes", "secret-token-value"])(
    "throws an error naming ENABLE_STAND_IN_WRITING, without echoing it, for %j",
    (value) => {
      expect(() => loadServerConfig({ ENABLE_STAND_IN_WRITING: value })).toThrow(
        /^ENABLE_STAND_IN_WRITING must be true or false$/,
      );
    },
  );

  it("uses the stand-in writing data source when WRITING_DATA_SOURCE says so", () => {
    expect(loadServerConfig({ WRITING_DATA_SOURCE: "stand-in" }).writingDataSource).toBe("stand-in");
  });

  it.each(["", "supabase", "STAND-IN", "secret-token-value"])(
    "throws an error naming WRITING_DATA_SOURCE, without echoing it, for %j",
    (value) => {
      expect(() => loadServerConfig({ WRITING_DATA_SOURCE: value })).toThrow(
        /^WRITING_DATA_SOURCE must be one of: stand-in$/,
      );
    },
  );

  it.each([SHA, "FEDCBA9"])("uses APP_VERSION %s as the version", (sha) => {
    expect(loadServerConfig({ APP_VERSION: sha }, "1.0.0").version).toBe(sha);
  });

  it("ignores host variables: the host's SHA reaches the app only as APP_VERSION", () => {
    expect(loadServerConfig({ COMMIT_REF: SHA, GITHUB_SHA: SHA }, "1.0.0").version).toBe("1.0.0");
    expect(loadServerConfig({ APP_VERSION: "abc1234", COMMIT_REF: SHA }, "1.0.0").version).toBe("abc1234");
  });

  it.each(["", "abc123", "x".repeat(7), `${SHA}0`, "secret-token-value", "abc1234; rm"])(
    "never echoes %j, which is not a commit SHA",
    (value) => {
      expect(loadServerConfig({ APP_VERSION: value }, "1.0.0").version).toBe("1.0.0");
    },
  );

  it("trims whitespace around a SHA", () => {
    expect(loadServerConfig({ APP_VERSION: " abc1234\n" }, "1.0.0").version).toBe("abc1234");
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
    vi.stubEnv("APP_VERSION", "abcdef1");
    vi.stubEnv("ENABLE_TEST_ROUTES", "true");
    vi.stubEnv("WRITING_DATA_SOURCE", "stand-in");
    vi.stubEnv("ENABLE_STAND_IN_WRITING", "false");
    vi.resetModules();

    const { serverConfig } = await import("./server");

    expect(serverConfig).toEqual({
      version: "abcdef1",
      testRoutes: true,
      writingDataSource: "stand-in",
      standInWriting: false,
    });
  });

  it("serves stand-in writing by default under NODE_ENV=production only when turned on", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_STAND_IN_WRITING", undefined);
    vi.resetModules();
    expect((await import("./server")).serverConfig.standInWriting).toBe(false);

    vi.stubEnv("ENABLE_STAND_IN_WRITING", "true");
    vi.resetModules();
    expect((await import("./server")).serverConfig.standInWriting).toBe(true);
  });

  it("never reads the host's SHA variables, so the package version applies without APP_VERSION", async () => {
    vi.stubEnv("APP_VERSION", undefined);
    vi.stubEnv("COMMIT_REF", SHA);
    vi.stubEnv("GITHUB_SHA", SHA);
    vi.resetModules();

    const { serverConfig } = await import("./server");

    expect(serverConfig.version).toBe(packageJson.version);
  });

  it("is marked server-only, so importing it from a client component fails the build", () => {
    const source = readFileSync(join(import.meta.dirname, "server.ts"), "utf8");
    expect(source.startsWith('import "server-only";')).toBe(true);
  });
});
