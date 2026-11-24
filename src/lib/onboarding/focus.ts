import { ONBOARDING_FIELDS, type OnboardingField, type OnboardingFieldErrors } from "@/contracts/onboarding";

/** The first field, in form order, that has an error; null when none has. */
export function firstInvalidField(errors: OnboardingFieldErrors): OnboardingField | null {
  return ONBOARDING_FIELDS.find((field) => errors[field] !== undefined) ?? null;
}

/** Moves focus to the first invalid field, so a keyboard or screen reader user lands on what to fix. */
export function focusFirstInvalid(
  errors: OnboardingFieldErrors,
  targets: Record<OnboardingField, { focus(): void } | null>,
): void {
  const field = firstInvalidField(errors);
  if (field) targets[field]?.focus();
}
