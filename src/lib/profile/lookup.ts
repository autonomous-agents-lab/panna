import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * The username of the profile with this id, or null when there is none. Throws when the database
 * can't answer, so a failed lookup is never mistaken for "no profile".
 */
export async function findProfileUsername(supabase: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Profile lookup failed (${error.code})`);
  return data?.username ?? null;
}
