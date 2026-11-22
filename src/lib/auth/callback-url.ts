import { AUTH_ROUTES, NEXT_PARAM } from "@/contracts/auth";

import { safeNextPath } from "./redirect";

/**
 * The absolute auth callback URL that magic links and Google send the user back to, built from
 * the configured site URL so no host is ever written in code. Carries a safe `next` path.
 */
export function buildAuthCallbackUrl(siteUrl: string, next: unknown): string {
  const url = new URL(AUTH_ROUTES.callback, siteUrl);
  const safe = safeNextPath(next, siteUrl);
  if (safe !== "/") url.searchParams.set(NEXT_PARAM, safe);
  return url.href;
}
