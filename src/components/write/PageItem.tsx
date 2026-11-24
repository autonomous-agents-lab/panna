import Link from "next/link";

import type { PageSummary } from "@/contracts";
import type { Translate } from "@/i18n";
import type { DashboardAction } from "@/lib/writing/dashboard/action-state";
import { titleLang } from "@/lib/writing/dashboard/view";
import { editorPath } from "@/lib/writing/routes";

import { MoveControls } from "./MoveControls";
import { RenameForm } from "./RenameForm";
import { StatusBadge } from "./StatusBadge";
import styles from "./write.module.css";

/** How a page is named on screen: its title, or the "Untitled page" placeholder. */
export function PageTitle({ page, t }: { page: Pick<PageSummary, "title" | "language">; t: Translate }) {
  if (page.title === null) return <span className={`${styles.pageTitle} ${styles.untitled}`}>{t("write.untitledPage")}</span>;
  return (
    <span className={styles.pageTitle} lang={titleLang(page.title, page.language)}>
      {page.title}
    </span>
  );
}

/** One page in a chapter: title, status, and its open, rename and move controls. */
export function PageItem({
  page,
  index,
  count,
  t,
  renamePage,
  movePage,
}: {
  page: PageSummary;
  index: number;
  count: number;
  t: Translate;
  renamePage: DashboardAction;
  movePage: DashboardAction;
}) {
  const displayTitle = page.title ?? t("write.untitledPage");
  return (
    <li className={styles.page}>
      <PageTitle page={page} t={t} />
      <StatusBadge status={page.status} t={t} />
      <div className={styles.controls}>
        <Link
          href={editorPath(page.id)}
          className={styles.link}
          aria-label={t("write.action.openNamed", { title: displayTitle })}
        >
          {t("write.action.open")}
        </Link>
        <RenameForm
          action={renamePage}
          idField="pageId"
          id={page.id}
          title={page.title}
          displayTitle={displayTitle}
          label={t("write.field.pageTitle")}
        />
        <MoveControls action={movePage} idField="pageId" id={page.id} title={displayTitle} index={index} count={count} />
      </div>
    </li>
  );
}
