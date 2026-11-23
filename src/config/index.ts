import { loadConfig } from "./schema";
import { loadSupabaseConfig, type SupabaseConfig } from "./supabase";

export type { Config } from "./schema";
export type { SupabaseConfig } from "./supabase";
export * from "./books";
export * from "./content";
export * from "./usernames";

// Each variable is read literally so Next.js can inline it into client bundles.
export const config = loadConfig({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND: process.env.NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND,
  NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB: process.env.NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB,
});

/**
 * Validated only when a Supabase client is created, so pages that don't use Supabase still
 * render (and the app still builds) while these variables are unset.
 */
export function getSupabaseConfig(): SupabaseConfig {
  return loadSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
