import type { Translate } from "@/i18n";
import type { DashboardAction } from "@/lib/writing/dashboard/action-state";
import { titleLang, type DashboardChapter } from "@/lib/writing/dashboard/view";

import { ActionButton } from "./ActionButton";
import { MoveControls } from "./MoveControls";
import { PageItem } from "./PageItem";
import { RenameForm } from "./RenameForm";
import styles from "./write.module.css";

export type ChapterListActions = Record<
  "createPage" | "renameChapter" | "renamePage" | "moveChapter" | "movePage",
  DashboardAction
>;

interface ListProps {
  t: Translate;
  actions: ChapterListActions;
}

/** The book's chapters in order, each with its pages in order. */
export function ChapterList({ chapters, ...props }: ListProps & { chapters: DashboardChapter[] }) {
  return (
    <ol className={styles.chapters} aria-label={props.t("write.chapters.label")}>
      {chapters.map((chapter, index) => (
        <ChapterItem key={chapter.id} chapter={chapter} index={index} count={chapters.length} {...props} />
      ))}
    </ol>
  );
}

function ChapterItem({
  chapter,
  index,
  count,
  t,
  actions,
}: ListProps & { chapter: DashboardChapter; index: number; count: number }) {
  const { id, title, pages } = chapter;
  return (
    <li className={styles.chapter}>
      <div className={styles.chapterHeader}>
        <h2 className={styles.chapterTitle} lang={titleLang(title, chapter.language)}>
          {title}
        </h2>
        <div className={styles.controls}>
          <RenameForm
            action={actions.renameChapter}
            idField="chapterId"
            id={id}
            title={title}
            displayTitle={title}
            label={t("write.field.chapterTitle")}
          />
          <MoveControls action={actions.moveChapter} idField="chapterId" id={id} title={title} index={index} count={count} />
          <ActionButton
            action={actions.createPage}
            fields={{ chapterId: id }}
            label={t("write.action.addPage")}
            accessibleName={t("write.action.addPageNamed", { title })}
            className={styles.control}
          />
        </div>
      </div>
      {pages.length === 0 ? (
        <p className={styles.hint}>{t("write.chapter.noPages")}</p>
      ) : (
        <ol className={styles.pages} aria-label={t("write.chapter.pagesLabel", { title })}>
          {pages.map((page, pageIndex) => (
            <PageItem
              key={page.id}
              page={page}
              index={pageIndex}
              count={pages.length}
              t={t}
              renamePage={actions.renamePage}
              movePage={actions.movePage}
            />
          ))}
        </ol>
      )}
    </li>
  );
}
