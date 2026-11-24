import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseConfig } from "@/config";
import { NEXT_PARAM } from "@/contracts/auth";
import { loginPath } from "@/lib/auth/login-url";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function exchanged(code: string): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  } catch {
    // e.g. the PKCE verifier cookie is missing because the link was opened in another browser.
    return false;
  }
}

/**
 * Where magic links and Google send the user back. Exchanges the one-time code for a session
 * cookie and continues to the safe `next` path; any failure lands on /login with a localised
 * error and the form to get a new link. Redirects stay on the request's own origin.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get(NEXT_PARAM));
  const code = searchParams.get("code");
  const failed = searchParams.has("error") || searchParams.has("error_code");

  if (code && !failed && hasSupabaseConfig() && (await exchanged(code))) {
    return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL(loginPath({ error: "link_invalid", next }), request.url));
}
