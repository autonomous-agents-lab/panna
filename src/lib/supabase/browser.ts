import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/config";

import type { Database } from "./database.types";

/** Supabase client for Client Components. Uses only the public URL and anon key. */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
