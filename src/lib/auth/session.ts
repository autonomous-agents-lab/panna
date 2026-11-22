import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { hasSupabaseConfig } from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { loginPath } from "./login-url";

/**
 * The signed-in user of the current request, verified with Supabase Auth, or null. Also null when
 * Supabase isn't configured, so public pages and the header still render (as signed out).
 * Cached per request, because the header and the page both ask.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/**
 * The signed-in user, for pages that need one. The proxy already guards protected paths; this
 * keeps a page safe on its own, sending a signed-out visitor to /login and back to `path`.
 */
export async function requireUser(path: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath({ next: path }));
  return user;
}
