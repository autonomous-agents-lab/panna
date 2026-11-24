/** Sections that need a signed-in user, with everything under them. */
export const PROTECTED_PATHS = ["/onboarding", "/settings"] as const;

/** True for a protected section or any path under it; false for look-alikes such as /settingsx. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
