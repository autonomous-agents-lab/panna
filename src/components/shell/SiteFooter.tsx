import { config } from "@/config";
import { getTranslator } from "@/i18n/server";

import styles from "./SiteFooter.module.css";

/** The minimal footer: the app name and what it is. The UI polish epic restyles it. */
export async function SiteFooter() {
  const { t } = await getTranslator();
  return (
    <footer className={styles.footer}>
      <p>{t("shell.footer", { appName: config.appName })}</p>
    </footer>
  );
}
