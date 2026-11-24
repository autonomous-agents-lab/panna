import type { z } from "zod";

import { TEXT_LIMITS } from "@/config/books";
import {
  ONBOARDING_FIELDS,
  type DisplayNameErrorCode,
  type OnboardingFieldErrors,
  type OnboardingValues,
} from "@/contracts/onboarding";
import { createProfileWithBookInputSchema } from "@/contracts/profile";
import { validateUsername } from "@/lib/username";

/** `create_profile_with_book` arguments, validated, trimmed and lowercased. */
export type ProfileWithBookArgs = z.output<typeof createProfileWithBookInputSchema>;

export type ParsedOnboarding =
  | { ok: true; input: ProfileWithBookArgs; values: OnboardingValues }
  | { ok: false; errors: OnboardingFieldErrors; values: OnboardingValues };

/** The three known fields as strings. Any other key (e.g. `id`, `user_id`) is never read. */
export function readOnboardingValues(formData: FormData): OnboardingValues {
  const read = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return Object.fromEntries(ONBOARDING_FIELDS.map((field) => [field, read(field)])) as OnboardingValues;
}

function displayNameError(raw: string): DisplayNameErrorCode {
  return [...raw.trim()].length > TEXT_LIMITS.displayName.max ? "too_long" : "required";
}

/**
 * Validates the onboarding form at the server boundary: the username against the shared rules (so
 * its code matches what the user saw while typing), then every field against the RPC's contract.
 */
export function parseOnboardingForm(formData: FormData): ParsedOnboarding {
  const values = readOnboardingValues(formData);
  const errors: OnboardingFieldErrors = {};

  const username = validateUsername(values.username);
  if (!username.ok) errors.username = username.code;

  const parsed = createProfileWithBookInputSchema.safeParse({
    p_username: values.username,
    p_display_name: values.display_name,
    p_preferred_language: values.preferred_language,
  });
  if (parsed.success && username.ok) return { ok: true, input: parsed.data, values };

  for (const issue of parsed.error?.issues ?? []) {
    if (issue.path[0] === "p_display_name") errors.display_name = displayNameError(values.display_name);
    if (issue.path[0] === "p_preferred_language") errors.preferred_language = "unsupported";
  }
  return { ok: false, errors, values };
}
