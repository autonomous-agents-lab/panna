import { AUTH_ROUTES, ERROR_PARAM, NEXT_PARAM, type LoginErrorCode } from "@/contracts/auth";

import { safeNextPath } from "./redirect";

/**
 * The /login path, with an error code and the page to return to. `next` is sanitised and left
 * out when it is just "/", which is where sign-in lands anyway.
 */
export function loginPath({ next, error }: { next?: unknown; error?: LoginErrorCode } = {}): string {
  const params = new URLSearchParams();
  if (error) params.set(ERROR_PARAM, error);
  const safe = safeNextPath(next);
  if (safe !== "/") params.set(NEXT_PARAM, safe);
  const query = params.toString();
  return query ? `${AUTH_ROUTES.login}?${query}` : AUTH_ROUTES.login;
}

/** Where a signed-out request for a protected page goes: /login, returning to that page after. */
export function loginRedirectPath(pathname: string, search: string): string {
  return loginPath({ next: `${pathname}${search}` });
}
