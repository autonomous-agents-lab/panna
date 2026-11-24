import type { Translate } from "@/i18n";
import { useTranslator } from "@/i18n/client";
import type { UsernameCheckState } from "@/lib/onboarding/username-checker";
import { usernameErrorMessage } from "@/lib/username";

import styles from "./OnboardingForm.module.css";

function statusText(state: UsernameCheckState, t: Translate): string {
  switch (state.status) {
    case "idle":
      return "";
    case "checking":
      return t("onboarding.username.checking");
    case "available":
      return t("onboarding.username.available", { username: state.username });
    case "unavailable": {
      const { key, values } = usernameErrorMessage(state.code);
      return t(key, values);
    }
  }
}

/**
 * Whether the typed username is free, announced politely as it changes. Always mounted, even when
 * empty, so screen readers pick up the first update.
 */
export function UsernameStatus({ id, state }: { id: string; state: UsernameCheckState }) {
  const t = useTranslator();
  const tone = state.status === "available" ? styles.available : state.status === "unavailable" ? styles.error : "";
  return (
    <p id={id} role="status" aria-live="polite" className={`${styles.status} ${tone}`.trim()}>
      {statusText(state, t)}
    </p>
  );
}
