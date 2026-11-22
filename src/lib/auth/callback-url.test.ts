import { describe, expect, it } from "vitest";

import { buildAuthCallbackUrl } from "./callback-url";

describe("buildAuthCallbackUrl (AC-2, AC-3)", () => {
  it("builds the callback on the configured site, not a fixed host", () => {
    expect(buildAuthCallbackUrl("https://kitaab.example.org", undefined)).toBe(
      "https://kitaab.example.org/auth/callback",
    );
    expect(buildAuthCallbackUrl("http://localhost:3100", "/")).toBe("http://localhost:3100/auth/callback");
  });

  it("carries a safe next path", () => {
    expect(buildAuthCallbackUrl("https://kitaab.example.org", "/settings?tab=1")).toBe(
      "https://kitaab.example.org/auth/callback?next=%2Fsettings%3Ftab%3D1",
    );
  });

  it("drops an off-site next (AC-5)", () => {
    expect(buildAuthCallbackUrl("https://kitaab.example.org", "https://evil.com")).toBe(
      "https://kitaab.example.org/auth/callback",
    );
  });
});
