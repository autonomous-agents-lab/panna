import Link from "next/link";

import { AUTH_ROUTES } from "@/contracts/auth";
import type { Translate } from "@/i18n";

import styles from "./auth.module.css";
import { SignOutForm } from "./SignOutForm";

/** The header's auth control: "Sign in" when signed out, "Sign out" when signed in. */
export function AuthNav({ signedIn, t }: { signedIn: boolean; t: Translate }) {
  if (signedIn) return <SignOutForm t={t} />;
  return (
    <Link href={AUTH_ROUTES.login} className={styles.navLink}>
      {t("auth.nav.signIn")}
    </Link>
  );
}
