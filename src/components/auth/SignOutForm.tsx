import { signOut } from "@/app/auth/actions";
import type { Translate } from "@/i18n";

import styles from "./auth.module.css";

/** A one-button form, so signing out works without JavaScript and is reachable by keyboard. */
export function SignOutForm({ t }: { t: Translate }) {
  return (
    <form action={signOut}>
      <button type="submit" className={styles.secondaryButton}>
        {t("auth.nav.signOut")}
      </button>
    </form>
  );
}
