import Link from "next/link";

import { AuthNav } from "@/components/auth/AuthNav";
import { LocaleSwitch } from "@/components/locale-switch/LocaleSwitch";
import { config } from "@/config";
import { getTranslator } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";

import styles from "./SiteHeader.module.css";

/** The minimal app shell: a home link, sign in or out, and the locale switch. The UI polish epic restyles it. */
export async function SiteHeader() {
  const [{ locale, t }, user] = await Promise.all([getTranslator(), getCurrentUser()]);
  return (
    <header className={styles.header}>
      <Link href="/" aria-label={t("shell.homeLink", { appName: config.appName })} className={styles.home}>
        {config.appName}
      </Link>
      <div className={styles.actions}>
        <AuthNav signedIn={user !== null} t={t} />
        <LocaleSwitch locale={locale} t={t} />
      </div>
    </header>
  );
}
