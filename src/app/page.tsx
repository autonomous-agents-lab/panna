import { config } from "@/config";
import { getTranslator } from "@/i18n/server";
import { pageMetadata } from "@/lib/page-metadata";

import styles from "./page.module.css";

export function generateMetadata() {
  return pageMetadata({ path: "/" });
}

/**
 * The pre-launch "Coming soon" home page. Static on purpose: no database, login or secret, so
 * production can serve it before Supabase is wired up. A later epic replaces it.
 */
export default async function HomePage() {
  const { t } = await getTranslator();
  return (
    <div className={styles.comingSoon}>
      <h1 className={styles.title}>{config.appName}</h1>
      <p className={styles.status}>{t("home.comingSoon")}</p>
      <p className={styles.tagline}>{t("home.tagline")}</p>
    </div>
  );
}
