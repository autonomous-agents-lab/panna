"use server";

import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "@/config";
import { ONBOARDING_PATH, type OnboardingResult, type UsernameAvailability } from "@/contracts/onboarding";
import { persistLocale } from "@/i18n/locale-cookie";
import { loginPath } from "@/lib/auth/login-url";
import { getCurrentUser } from "@/lib/auth/session";
import { checkAvailability, supabaseAvailabilityLookups } from "@/lib/onboarding/availability";
import { isDuplicateProfileError } from "@/lib/onboarding/db-error";
import { parseOnboardingForm } from "@/lib/onboarding/parse";
import { findProfileUsername } from "@/lib/profile/lookup";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { usernameErrorFromDb } from "@/lib/username";

/** Whether a typed username is free, for the form's live status. Advisory: `createProfile` decides. */
export async function checkUsername(raw: unknown): Promise<UsernameAvailability> {
  if (typeof raw !== "string" || !hasSupabaseConfig()) return { status: "unknown" };
  return checkAvailability(raw, supabaseAvailabilityLookups(await createSupabaseServerClient()));
}

/**
 * The onboarding form's action. Validates every field, then creates the profile and book in one
 * database call that takes the owner from the session (`auth.uid()`), never from the form. On
 * success it switches the UI to the chosen language and opens the new book at /<username>.
 */
export async function createProfile(_previous: OnboardingResult, formData: FormData): Promise<OnboardingResult> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath({ next: ONBOARDING_PATH }));

  const parsed = parseOnboardingForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };
  const { input, values } = parsed;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_profile_with_book", input);
  if (error) {
    const username = usernameErrorFromDb(error);
    if (username) return { status: "invalid", errors: { username }, values };
    if (!isDuplicateProfileError(error)) return { status: "failed", values };
    // Already onboarded (e.g. a second tab): go to the book they have.
    const existing = await findProfileUsername(supabase, user.id).catch(() => null);
    if (!existing) return { status: "failed", values };
    redirect(`/${existing}`);
  }

  // The function stores the username trimmed and lowercased, exactly as `input` already is.
  await persistLocale(input.p_preferred_language);
  redirect(`/${input.p_username}`);
}
