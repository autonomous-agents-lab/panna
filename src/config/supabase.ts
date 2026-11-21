import { z } from "zod";

import type { RawEnv } from "./schema";

const COPY_HINT = "Run `npx supabase status` and copy the value into .env.local.";

/** Treats an empty or blank value the same as an unset one. */
function blankAsMissing(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function message(variable: string, invalid: string) {
  return (issue: { input: unknown }) =>
    issue.input === undefined ? `${variable} is not set. ${COPY_HINT}` : `${variable} ${invalid}. ${COPY_HINT}`;
}

export const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    blankAsMissing,
    z.url({ error: message("NEXT_PUBLIC_SUPABASE_URL", "must be an absolute URL") }),
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    blankAsMissing,
    z.string({ error: message("NEXT_PUBLIC_SUPABASE_ANON_KEY", "must be text") }).trim(),
  ),
});

export type SupabaseConfig = { url: string; anonKey: string };

/** Validates the Supabase env values. Throws a ZodError naming each missing or invalid variable. */
export function loadSupabaseConfig(raw: RawEnv): SupabaseConfig {
  const env = supabaseEnvSchema.parse(raw);
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}
