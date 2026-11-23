import { NextResponse, type NextRequest } from "next/server";

import { loginRedirectPath } from "@/lib/auth/login-url";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { updateSession } from "@/lib/supabase/proxy";

/** The headers Supabase adds when it sets auth cookies, so no cache stores them. */
const NO_STORE_HEADERS = ["cache-control", "expires", "pragma"];

/**
 * Runs before every matched request: refreshes the Supabase session, and sends a signed-out
 * request for a protected page to /login, returning to that page after sign-in.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (user || !isProtectedPath(pathname)) return response;

  const redirect = NextResponse.redirect(new URL(loginRedirectPath(pathname, search), request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const name of NO_STORE_HEADERS) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

// Static assets, image optimisation, the manifest, icons and the health check never need a session.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/health|manifest\\.webmanifest|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt|xml)$).*)",
  ],
};
