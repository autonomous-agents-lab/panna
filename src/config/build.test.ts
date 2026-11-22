import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTimeEnv } from "./build";

describe("buildTimeEnv", () => {
  it("passes APP_VERSION through so the build reports its commit", () => {
    expect(buildTimeEnv({ APP_VERSION: "abc1234", COMMIT_REF: "fedcba9" })).toEqual({ APP_VERSION: "abc1234" });
  });

  it.each([undefined, ""])("leaves APP_VERSION out when it is %j, so a runtime value still applies", (value) => {
    expect(buildTimeEnv({ APP_VERSION: value })).toEqual({});
  });
});

describe("next.config.ts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exposes the build's APP_VERSION to the server build", async () => {
    vi.stubEnv("APP_VERSION", "abc1234");
    vi.resetModules();

    const { default: nextConfig } = await import("../../next.config");

    expect(nextConfig.env).toEqual({ APP_VERSION: "abc1234" });
  });
});
