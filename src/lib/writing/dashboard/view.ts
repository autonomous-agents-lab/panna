import type { ChapterWithPages, Language, PageSummary } from "@/contracts";

export interface DashboardChapter {
  id: string;
  title: string;
  language: Language;
  /** The chapter's pages that aren't archived, in order. */
  pages: PageSummary[];
}

export interface ArchivedPage extends PageSummary {
  chapterTitle: string;
  chapterLanguage: Language;
}

export interface DashboardView {
  chapters: DashboardChapter[];
  /** Archived pages, kept apart from the chapters, each with the chapter it belongs to. */
  archived: ArchivedPage[];
}

const isArchived = (page: PageSummary) => page.status === "archived";

/** The dashboard's lists, from the repository's chapters (already in order, each with its pages in order). */
export function toDashboardView(chapters: readonly ChapterWithPages[]): DashboardView {
  return {
    chapters: chapters.map(({ id, title, language, pages }) => ({
      id,
      title,
      language,
      pages: pages.filter((page) => !isArchived(page)),
    })),
    archived: chapters.flatMap((chapter) =>
      chapter.pages
        .filter(isArchived)
        .map((page) => ({ ...page, chapterTitle: chapter.title, chapterLanguage: chapter.language })),
    ),
  };
}

const DEVANAGARI = /\p{Script=Devanagari}/u;

/**
 * The `lang` for a title: Hindi when it has any Devanagari, so the Devanagari UI font applies
 * even to a Hindi title on an English page, otherwise the item's own language.
 */
export function titleLang(title: string, fallback: Language): Language {
  return DEVANAGARI.test(title) ? "hi" : fallback;
}
