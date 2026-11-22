import { describe, expect, it } from "vitest";

import { isProtectedPath } from "./protected-routes";

describe("isProtectedPath (AC-4)", () => {
  it.each(["/settings", "/settings/", "/settings/profile", "/onboarding", "/onboarding/step/2"])(
    "protects %j",
    (pathname) => {
      expect(isProtectedPath(pathname)).toBe(true);
    },
  );

  it.each(["/", "/login", "/auth/callback", "/settingsx", "/onboardingx/a", "/about/settings", "/Settings"])(
    "leaves %j public",
    (pathname) => {
      expect(isProtectedPath(pathname)).toBe(false);
    },
  );
});
