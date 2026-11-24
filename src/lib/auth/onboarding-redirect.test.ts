import { describe, expect, it } from "vitest";

import { onboardingRedirect, postSignInPath } from "./onboarding-redirect";

describe("onboardingRedirect (AC-1)", () => {
  it.each(["/settings", "/settings/profile"])("sends a user without a profile from %s to /onboarding", (path) => {
    expect(onboardingRedirect(path, false)).toBe("/onboarding");
  });

  it.each(["/onboarding", "/onboarding/step"])("never loops a user without a profile on %s", (path) => {
    expect(onboardingRedirect(path, false)).toBeNull();
  });

  it.each(["/", "/login", "/asha", "/settingsx"])("leaves the public page %s alone", (path) => {
    expect(onboardingRedirect(path, false)).toBeNull();
  });

  it.each(["/settings", "/onboarding", "/"])("never redirects a user who has a profile from %s", (path) => {
    expect(onboardingRedirect(path, true)).toBeNull();
  });
});

describe("postSignInPath (AC-1)", () => {
  it("sends a first-time user to /onboarding whatever they asked for", () => {
    expect(postSignInPath("/settings", false)).toBe("/onboarding");
  });

  it("continues to next for a user with a profile", () => {
    expect(postSignInPath("/settings?tab=1", true)).toBe("/settings?tab=1");
  });
});
