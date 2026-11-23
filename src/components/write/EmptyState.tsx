import type { Translate } from "@/i18n";
import type { DashboardAction } from "@/lib/writing/dashboard/action-state";

import { ActionButton } from "./ActionButton";
import styles from "./write.module.css";

const HEADING_ID = "write-empty-heading";

/** For a book with nothing in it yet: one clear first step, which opens the new page in the editor. */
export function EmptyState({ t, startWriting }: { t: Translate; startWriting: DashboardAction }) {
  return (
    <section className={styles.empty} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID}>{t("write.empty.heading")}</h2>
      <p>{t("write.empty.body")}</p>
      <ActionButton action={startWriting} label={t("write.empty.start")} className={styles.primary} />
    </section>
  );
}
