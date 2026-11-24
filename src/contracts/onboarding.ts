import type { UsernameErrorCode } from "./username";

/** Where a signed-in user without a profile is sent to claim a username. */
export const ONBOARDING_PATH = "/onboarding";

/** The onboarding form's fields, in the order they appear (and are focused on error). */
export const ONBOARDING_FIELDS = ["username", "display_name", "preferred_language"] as const;
export type OnboardingField = (typeof ONBOARDING_FIELDS)[number];

export const DISPLAY_NAME_ERROR_CODES = ["required", "too_long"] as const;
export type DisplayNameErrorCode = (typeof DISPLAY_NAME_ERROR_CODES)[number];

export const PREFERRED_LANGUAGE_ERROR_CODES = ["unsupported"] as const;
export type PreferredLanguageErrorCode = (typeof PREFERRED_LANGUAGE_ERROR_CODES)[number];

/** Why each field was rejected. Codes, not text, so the form shows them in the current language. */
export interface OnboardingFieldErrors {
  username?: UsernameErrorCode;
  display_name?: DisplayNameErrorCode;
  preferred_language?: PreferredLanguageErrorCode;
}

/** What was submitted, echoed back so the form keeps it after React resets it. */
export type OnboardingValues = Record<OnboardingField, string>;

/** The `createProfile` Server Action's result. Success redirects, so it has no result. */
export type OnboardingResult =
  | { status: "idle" }
  | { status: "invalid"; errors: OnboardingFieldErrors; values: OnboardingValues }
  | { status: "failed"; values: OnboardingValues };

/**
 * The `checkUsername` Server Action's answer while the user types. `unknown` means the check
 * couldn't run (e.g. the database was unreachable); submitting still decides.
 */
export type UsernameAvailability =
  | { status: "available"; username: string }
  | { status: "unavailable"; code: UsernameErrorCode }
  | { status: "unknown" };
