import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { findProfileUsername } from "./lookup";

/** The signed-in user's profile, as pages need it. */
export type CurrentProfile = { id: string; username: string };

/**
 * The current request's profile, or null when signed out or not onboarded yet. Cached per
 * request. A database failure throws, so the error page shows rather than the onboarding form.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const username = await findProfileUsername(await createSupabaseServerClient(), user.id);
  return username === null ? null : { id: user.id, username };
});
