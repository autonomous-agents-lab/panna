import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig, hasSupabaseConfig } from "@/config";

import type { Database } from "./database.types";

/**
 * Refreshes the request's Supabase session in the proxy. Refreshed cookies go both onto the
 * request (so Server Components rendering it see them) and onto the response (so the browser
 * keeps them). Without Supabase config the request passes through as signed out.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });
  if (!hasSupabaseConfig()) return { response, user: null };

  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Keeps a CDN from caching one user's session cookies for another.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getUser() asks Supabase Auth, so a forged or revoked token never counts as signed in.
  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}
