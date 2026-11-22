import Link from "next/link";

import { LocaleSwitch } from "@/components/locale-switch/LocaleSwitch";
import { config } from "@/config";
import { getTranslator } from "@/i18n/server";

import styles from "./SiteHeader.module.css";

/** The minimal app shell: a home link and the locale switch. The UI polish epic restyles it. */
export async function SiteHeader() {
  const { locale, t } = await getTranslator();
  return (
    <header className={styles.header}>
      <Link href="/" aria-label={t("shell.homeLink", { appName: config.appName })} className={styles.home}>
        {config.appName}
      </Link>
      <LocaleSwitch locale={locale} t={t} />
    </header>
  );
}
