import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseConfig } from "@/config";
import { NEXT_PARAM } from "@/contracts/auth";
import { loginPath } from "@/lib/auth/login-url";
import { postSignInPath } from "@/lib/auth/onboarding-redirect";
import { safeNextPath } from "@/lib/auth/redirect";
import { findProfileUsername } from "@/lib/profile/lookup";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Exchanges the code for a session; true when signed in and the user has a profile. Null on failure. */
async function signIn(code: string): Promise<{ hasProfile: boolean } | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return null;
    // A failed lookup continues to `next`; the proxy checks the profile again there.
    const username = await findProfileUsername(supabase, data.user.id).catch(() => undefined);
    return { hasProfile: username !== null };
  } catch {
    // e.g. the PKCE verifier cookie is missing because the link was opened in another browser.
    return null;
  }
}

/**
 * Where magic links and Google send the user back. Exchanges the one-time code for a session
 * cookie and continues to the safe `next` path, or to /onboarding for a user with no profile yet;
 * any failure lands on /login with a localised error and the form to get a new link. Redirects
 * stay on the request's own origin.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get(NEXT_PARAM));
  const code = searchParams.get("code");
  const failed = searchParams.has("error") || searchParams.has("error_code");

  const signedIn = code && !failed && hasSupabaseConfig() ? await signIn(code) : null;
  if (signedIn) return NextResponse.redirect(new URL(postSignInPath(next, signedIn.hasProfile), request.url));
  return NextResponse.redirect(new URL(loginPath({ error: "link_invalid", next }), request.url));
}
