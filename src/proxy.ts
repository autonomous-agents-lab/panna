import { NextResponse, type NextRequest } from "next/server";

import { loginRedirectPath } from "@/lib/auth/login-url";
import { onboardingRedirect } from "@/lib/auth/onboarding-redirect";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { findProfileUsername } from "@/lib/profile/lookup";
import { updateSession } from "@/lib/supabase/proxy";

/** The headers Supabase adds when it sets auth cookies, so no cache stores them. */
const NO_STORE_HEADERS = ["cache-control", "expires", "pragma"];

/** A redirect that keeps the refreshed session cookies and no-store headers of `response`. */
function redirectKeepingSession(response: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const name of NO_STORE_HEADERS) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

/**
 * Runs before every matched request: refreshes the Supabase session, sends a signed-out request
 * for a protected page to /login (returning to that page after sign-in), and sends a signed-in
 * user who has no profile yet to /onboarding.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, user, supabase } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (!isProtectedPath(pathname)) return response;
  if (!user) return redirectKeepingSession(response, new URL(loginRedirectPath(pathname, search), request.url));

  // A failed lookup lets the request through; the page checks the profile again itself.
  const username = await findProfileUsername(supabase, user.id).catch(() => undefined);
  const target = onboardingRedirect(pathname, username !== null);
  return target ? redirectKeepingSession(response, new URL(target, request.url)) : response;
}

// Static assets, image optimisation, the manifest, icons and the health check never need a session.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/health|manifest\\.webmanifest|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt|xml)$).*)",
  ],
};
