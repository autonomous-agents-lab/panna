import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { DEFAULT_APP_NAME } from "./defaults";
import { loadConfig, type RawEnv } from "./schema";

function expectEnvError(raw: RawEnv, variable: string) {
  let thrown: unknown;
  try {
    loadConfig(raw);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ZodError);
  const zodError = thrown as ZodError;
  expect(zodError.issues.map((issue) => issue.path)).toContainEqual([variable]);
  expect(zodError.message).toContain(variable);
}

describe("loadConfig", () => {
  it("uses the defaults when nothing is set", () => {
    expect(loadConfig({})).toEqual({
      appName: DEFAULT_APP_NAME,
      siteUrl: "http://localhost:3000",
      features: { pageTurnSound: true },
      limits: { maxImageUploadMb: 5 },
    });
  });

  describe("NEXT_PUBLIC_APP_NAME", () => {
    it("defaults to Panna when unset", () => {
      expect(loadConfig({ NEXT_PUBLIC_APP_NAME: undefined }).appName).toBe("Panna");
    });

    it("uses the configured name", () => {
      expect(loadConfig({ NEXT_PUBLIC_APP_NAME: "Kitaab" }).appName).toBe("Kitaab");
    });

    it("trims surrounding whitespace", () => {
      expect(loadConfig({ NEXT_PUBLIC_APP_NAME: "  Kitaab " }).appName).toBe("Kitaab");
    });

    it.each(["", "   "])("rejects a blank name %j", (value) => {
      expectEnvError({ NEXT_PUBLIC_APP_NAME: value }, "NEXT_PUBLIC_APP_NAME");
    });
  });

  describe("NEXT_PUBLIC_SITE_URL", () => {
    it("uses a valid URL", () => {
      expect(loadConfig({ NEXT_PUBLIC_SITE_URL: "https://example.org" }).siteUrl).toBe(
        "https://example.org",
      );
    });

    it("rejects a value that is not a URL", () => {
      expectEnvError({ NEXT_PUBLIC_SITE_URL: "not-a-url" }, "NEXT_PUBLIC_SITE_URL");
    });
  });

  describe("NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND", () => {
    it.each([
      ["false", false],
      ["0", false],
      ["true", true],
      ["1", true],
    ])("parses %j as %s", (value, expected) => {
      expect(
        loadConfig({ NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND: value }).features.pageTurnSound,
      ).toBe(expected);
    });

    it("rejects a value that is not a boolean", () => {
      expectEnvError(
        { NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND: "maybe" },
        "NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND",
      );
    });
  });

  describe("NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB", () => {
    it("parses a positive integer", () => {
      expect(
        loadConfig({ NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB: "12" }).limits.maxImageUploadMb,
      ).toBe(12);
    });

    it.each(["abc", "-1", "0", "2.5", ""])("rejects %j", (value) => {
      expectEnvError(
        { NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB: value },
        "NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB",
      );
    });
  });
});

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads every variable from process.env", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Kitaab");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.org");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND", "false");
    vi.stubEnv("NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB", "8");
    vi.resetModules();

    const { config } = await import("./index");

    expect(config).toEqual({
      appName: "Kitaab",
      siteUrl: "https://example.org",
      features: { pageTurnSound: false },
      limits: { maxImageUploadMb: 8 },
    });
  });
});
