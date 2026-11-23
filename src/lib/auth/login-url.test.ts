import { describe, expect, it } from "vitest";

import { loginPath, loginRedirectPath } from "./login-url";

describe("loginRedirectPath (AC-4)", () => {
  it("sends a protected request to /login with the whole path and query as next", () => {
    expect(loginRedirectPath("/settings/x", "?y=1")).toBe("/login?next=%2Fsettings%2Fx%3Fy%3D1");
    expect(loginRedirectPath("/onboarding", "")).toBe("/login?next=%2Fonboarding");
  });
});

describe("loginPath", () => {
  it("is plain /login with nothing to carry", () => {
    expect(loginPath()).toBe("/login");
    expect(loginPath({ next: "/" })).toBe("/login");
  });

  it("carries the error code and a safe next", () => {
    expect(loginPath({ error: "link_invalid", next: "/settings" })).toBe("/login?error=link_invalid&next=%2Fsettings");
    expect(loginPath({ error: "oauth_failed" })).toBe("/login?error=oauth_failed");
  });

  it("drops an off-site next (AC-5)", () => {
    expect(loginPath({ error: "link_invalid", next: "//evil.com" })).toBe("/login?error=link_invalid");
  });
});
