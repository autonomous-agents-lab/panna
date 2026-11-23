import { redirect } from "next/navigation";
import { cache } from "react";

import { hasSupabaseConfig } from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { loginPath } from "./login-url";

/** Who is signed in, as pages need it. */
export type SignedInUser = { id: string; email?: string };

/**
 * The signed-in user of the current request, or null. Also null when Supabase isn't configured,
 * so public pages and the header still render (as signed out). The proxy has already verified
 * and refreshed the session with Supabase Auth, so this only verifies the access token's claims:
 * locally with asymmetric signing keys, while HS256 projects (the local stack's default) fall back
 * to asking Auth. Cached per request, because the header and the page both ask.
 */
export const getCurrentUser = cache(async (): Promise<SignedInUser | null> => {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;
  const { sub, email } = data.claims;
  return email === undefined ? { id: sub } : { id: sub, email };
});

/**
 * The signed-in user, for pages that need one. The proxy already guards protected paths; this
 * keeps a page safe on its own, sending a signed-out visitor to /login and back to `path`.
 */
export async function requireUser(path: string): Promise<SignedInUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath({ next: path }));
  return user;
}
