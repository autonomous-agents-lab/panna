import type { PageStatus } from "@/contracts";
import type { MessageKey, Translate } from "@/i18n";

import styles from "./write.module.css";

const LABELS = {
  draft: "write.status.draft",
  published: "write.status.published",
  archived: "write.status.archived",
} as const satisfies Record<PageStatus, MessageKey>;

/** A page's status as a text label, with a colour that only repeats what the text says. */
export function StatusBadge({ status, t }: { status: PageStatus; t: Translate }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{t(LABELS[status])}</span>;
}
