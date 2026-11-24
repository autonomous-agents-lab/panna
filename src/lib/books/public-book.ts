import { hasSupabaseConfig } from "@/config";
import { PUBLIC_BOOK_SELECT, publicBookSchema, type PublicBook } from "@/contracts/public-book";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The public book at /<username>, looked up case-insensitively, or null when there is none (or no
 * Supabase to ask). Deactivated writers are hidden by row level security, so they read as none.
 * A database failure throws, so the visitor gets the error page rather than a false 404.
 */
export async function getPublicBook(username: string): Promise<PublicBook | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_BOOK_SELECT)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Book lookup failed (${error.code})`);
  const parsed = publicBookSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
