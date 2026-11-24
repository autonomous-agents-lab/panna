import type { SupabaseClient } from "@supabase/supabase-js";

import type { UsernameAvailability } from "@/contracts/onboarding";
import { usernameHeldUntilResultSchema } from "@/contracts/username";
import type { Database } from "@/lib/supabase/database.types";
import { validateUsername } from "@/lib/username";

/** What the check asks the database. Both throw when it can't answer. */
export interface AvailabilityLookups {
  /** When a released name is free again, or null if no one holds it. */
  heldUntil(username: string): Promise<Date | null>;
  /** Whether an active profile already has this (lowercase) name. */
  isTaken(username: string): Promise<boolean>;
}

/**
 * Whether a typed username can be claimed right now. The shared rules run first, so an invalid or
 * reserved name never reaches the database. Advisory only: submitting decides.
 */
export async function checkAvailability(raw: string, lookups: AvailabilityLookups): Promise<UsernameAvailability> {
  const local = validateUsername(raw);
  if (!local.ok) return { status: "unavailable", code: local.code };
  try {
    const held = validateUsername(raw, { heldUntil: await lookups.heldUntil(local.username) });
    if (!held.ok) return { status: "unavailable", code: held.code };
    if (await lookups.isTaken(local.username)) return { status: "unavailable", code: "taken" };
  } catch {
    return { status: "unknown" };
  }
  return { status: "available", username: local.username };
}

/** The lookups against Supabase, as the caller's role sees them (deactivated profiles are hidden). */
export function supabaseAvailabilityLookups(supabase: SupabaseClient<Database>): AvailabilityLookups {
  return {
    async heldUntil(username) {
      const { data, error } = await supabase.rpc("username_held_until", { p_username: username });
      if (error) throw new Error(`username_held_until failed (${error.code})`);
      const until = usernameHeldUntilResultSchema.parse(data);
      return until === null ? null : new Date(until);
    },
    async isTaken(username) {
      const { data, error } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (error) throw new Error(`Username lookup failed (${error.code})`);
      return data !== null;
    },
  };
}
