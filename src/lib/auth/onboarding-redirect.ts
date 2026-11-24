import { ONBOARDING_PATH } from "@/contracts/onboarding";

import { isProtectedPath } from "./protected-routes";

function isOnboardingPath(pathname: string): boolean {
  return pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
}

/**
 * Where a signed-in user's request for `pathname` must go instead: /onboarding when they have no
 * profile yet and the page is protected (other than onboarding itself), otherwise nowhere (null).
 */
export function onboardingRedirect(pathname: string, hasProfile: boolean): string | null {
  if (hasProfile || !isProtectedPath(pathname) || isOnboardingPath(pathname)) return null;
  return ONBOARDING_PATH;
}

/** Where sign-in lands: the safe `next` path, or /onboarding for a user who has no profile yet. */
export function postSignInPath(next: string, hasProfile: boolean): string {
  return hasProfile ? next : ONBOARDING_PATH;
}
