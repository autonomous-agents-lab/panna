import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/config";

import { createCookieAdapter } from "./cookies";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Route Handlers and Server Functions. Create one per
 * request; it reads and writes the auth cookies of that request.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseConfig();
  const store = await cookies();
  return createServerClient<Database>(url, anonKey, { cookies: createCookieAdapter(store) });
}
