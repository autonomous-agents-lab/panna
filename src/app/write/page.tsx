import { ArchivedSection } from "@/components/write/ArchivedSection";
import { ChapterList } from "@/components/write/ChapterList";
import { DashboardStatusProvider } from "@/components/write/DashboardStatus";
import { EmptyState } from "@/components/write/EmptyState";
import { NewChapterForm } from "@/components/write/NewChapterForm";
import styles from "@/components/write/write.module.css";
import { getTranslator } from "@/i18n/server";
import { pageMetadata } from "@/lib/page-metadata";
import { toDashboardView } from "@/lib/writing/dashboard/view";
import { WRITE_PATH } from "@/lib/writing/routes";

import { createChapter, createPage, moveChapter, movePage, renameChapter, renamePage, startWriting } from "./actions";
import { assertWritingEnabled, loadWriting } from "./guard";

// A writer's own workspace: never indexed.
export function generateMetadata() {
  assertWritingEnabled();
  return pageMetadata({ path: WRITE_PATH, titleKey: "write.title", noindex: true });
}

/**
 * The writing dashboard, rendered on the server from the repository on every request, so it
 * always shows the last saved state. Changes go through Server Actions that revalidate it.
 */
export default async function WritePage() {
  const { repository, writer } = await loadWriting();
  const [{ t }, chapters] = await Promise.all([getTranslator(), repository.listChapters(writer)]);
  if (!chapters.ok) throw new Error(`Listing the writer's chapters failed: ${chapters.error}`);
  const view = toDashboardView(chapters.value);

  return (
    <div className={styles.dashboard}>
      <h1>{t("write.title")}</h1>
      <DashboardStatusProvider>
        {view.chapters.length === 0 ? (
          <EmptyState t={t} startWriting={startWriting} />
        ) : (
          <>
            <ChapterList
              chapters={view.chapters}
              t={t}
              actions={{ createPage, renameChapter, renamePage, moveChapter, movePage }}
            />
            <NewChapterForm action={createChapter} />
            <ArchivedSection pages={view.archived} t={t} />
          </>
        )}
      </DashboardStatusProvider>
    </div>
  );
}
