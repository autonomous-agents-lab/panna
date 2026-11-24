import Link from "next/link";

import type { Translate } from "@/i18n";
import { titleLang, type ArchivedPage } from "@/lib/writing/dashboard/view";
import { editorPath } from "@/lib/writing/routes";

import { PageTitle } from "./PageItem";
import { StatusBadge } from "./StatusBadge";
import styles from "./write.module.css";

/**
 * Archived pages, kept (never deleted) in a collapsed section of their own. Read-only here: the
 * repository refuses edits to archived pages, and restoring belongs to the publish/archive story.
 */
export function ArchivedSection({ pages, t }: { pages: ArchivedPage[]; t: Translate }) {
  if (pages.length === 0) return null;
  return (
    <details className={styles.archivedSection}>
      <summary>{t("write.archived.summary", { count: pages.length })}</summary>
      <ul className={styles.archivedList}>
        {pages.map((page) => {
          const displayTitle = page.title ?? t("write.untitledPage");
          return (
            <li key={page.id} className={styles.archivedItem}>
              <PageTitle page={page} t={t} />
              <StatusBadge status={page.status} t={t} />
              <span>
                {t("write.archived.chapter")}{" "}
                <span lang={titleLang(page.chapterTitle, page.chapterLanguage)}>{page.chapterTitle}</span>
              </span>
              <Link
                href={editorPath(page.id)}
                className={styles.link}
                aria-label={t("write.action.openNamed", { title: displayTitle })}
              >
                {t("write.action.open")}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
