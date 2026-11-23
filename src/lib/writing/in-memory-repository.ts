import {
  pageStatusOf,
  type Chapter,
  type CurrentWriter,
  type PageSummary,
  type RichTextDocument,
  type WritingFailure,
  type WritingPage,
  type WritingRepository,
  type WritingResult,
} from "@/contracts";

import { nextPosition, reorder } from "./reorder";

/** A book the store knows about, and who owns it. */
export interface InMemoryBook {
  id: string;
  userId: string;
}

export interface InMemoryWritingOptions {
  books: readonly InMemoryBook[];
  now?: () => Date;
  newId?: () => string;
}

/** The pages.body column default (contracts.test.ts checks the migration). */
const EMPTY_BODY: RichTextDocument = { type: "doc", content: [{ type: "paragraph" }] };

const ok = <T>(value: T): WritingResult<T> => ({ ok: true, value: structuredClone(value) });
const NOT_FOUND: WritingFailure = { ok: false, error: "not_found" };
const INVALID_ORDER: WritingFailure = { ok: false, error: "invalid_order" };
const PAGE_ARCHIVED: WritingFailure = { ok: false, error: "page_archived" };

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

const summaryOf = (page: WritingPage): PageSummary => ({
  id: page.id,
  chapter_id: page.chapter_id,
  position: page.position,
  title: page.title,
  status: pageStatusOf(page),
  language: page.language,
  updated_at: page.updated_at,
});

/**
 * A WritingRepository kept in memory, for building and testing the writing epic before the real
 * tables and auth exist. It mirrors the database's rules: rows are scoped to the writer's own
 * book, published_at and archived_at are stamped here and never taken from input, and an
 * archived page can only be restored. Callers get copies, so they can't change the store.
 */
export function createInMemoryWritingRepository({
  books,
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
}: InMemoryWritingOptions): WritingRepository {
  const owners = new Map(books.map((book) => [book.id, book.userId]));
  const chapters = new Map<string, Chapter>();
  const pages = new Map<string, WritingPage>();

  const timestamp = () => now().toISOString();
  const ownsBook = (writer: CurrentWriter) => owners.get(writer.bookId) === writer.userId;

  const chaptersOf = (bookId: string) => [...chapters.values()].filter((c) => c.book_id === bookId).sort(byPosition);
  const pagesOf = (chapterId: string) => [...pages.values()].filter((p) => p.chapter_id === chapterId).sort(byPosition);

  function findChapter(writer: CurrentWriter, id: string): Chapter | undefined {
    const chapter = chapters.get(id);
    return ownsBook(writer) && chapter?.book_id === writer.bookId ? chapter : undefined;
  }

  function findPage(writer: CurrentWriter, id: string): WritingPage | undefined {
    const page = pages.get(id);
    return ownsBook(writer) && page?.book_id === writer.bookId ? page : undefined;
  }

  function addChapter(writer: CurrentWriter, title: string, language: Chapter["language"]): Chapter {
    const at = timestamp();
    const chapter: Chapter = {
      id: newId(),
      book_id: writer.bookId,
      position: nextPosition(chaptersOf(writer.bookId)),
      title,
      status: "draft",
      published_at: null,
      archived_at: null,
      language,
      created_at: at,
      updated_at: at,
    };
    chapters.set(chapter.id, chapter);
    return chapter;
  }

  /** Applies `change` to a page that isn't archived and stamps updated_at, as the database's trigger does. */
  function editPage(writer: CurrentWriter, pageId: string, change: (page: WritingPage, at: string) => void) {
    const page = findPage(writer, pageId);
    if (!page) return NOT_FOUND;
    if (page.archived_at !== null) return PAGE_ARCHIVED;
    const at = timestamp();
    change(page, at);
    page.updated_at = at;
    return ok(page);
  }

  /** Rewrites positions; only rows whose position changes are touched. */
  function applyOrder<T extends { id: string; position: number; updated_at: string }>(rows: T[], ids: string[]) {
    const result = reorder(
      rows.map((row) => row.id),
      ids,
    );
    if (!result.ok) return false;
    const at = timestamp();
    for (const row of rows) {
      const position = result.positions.get(row.id)!;
      if (row.position !== position) Object.assign(row, { position, updated_at: at });
    }
    return true;
  }

  return {
    async listChapters(writer) {
      if (!ownsBook(writer)) return NOT_FOUND;
      return ok(chaptersOf(writer.bookId).map((chapter) => ({ ...chapter, pages: pagesOf(chapter.id).map(summaryOf) })));
    },

    async createChapter(writer, { title, language }) {
      if (!ownsBook(writer)) return NOT_FOUND;
      return ok(addChapter(writer, title, language));
    },

    async renameChapter(writer, { chapterId, title }) {
      const chapter = findChapter(writer, chapterId);
      if (!chapter) return NOT_FOUND;
      Object.assign(chapter, { title, updated_at: timestamp() });
      return ok(chapter);
    },

    async reorderChapters(writer, { chapterIds }) {
      if (!ownsBook(writer)) return NOT_FOUND;
      if (!applyOrder(chaptersOf(writer.bookId), chapterIds)) return INVALID_ORDER;
      return ok(chaptersOf(writer.bookId));
    },

    async createPage(writer, input) {
      if (!ownsBook(writer)) return NOT_FOUND;
      let chapter: Chapter | undefined;
      if ("chapterId" in input) {
        chapter = findChapter(writer, input.chapterId);
        if (!chapter) return NOT_FOUND;
      } else {
        chapter = chaptersOf(writer.bookId).at(-1) ?? addChapter(writer, input.firstChapterTitle, input.language);
      }
      const at = timestamp();
      const page: WritingPage = {
        id: newId(),
        book_id: writer.bookId,
        chapter_id: chapter.id,
        position: nextPosition(pagesOf(chapter.id)),
        status: "draft",
        published_at: null,
        archived_at: null,
        language: input.language,
        body: structuredClone(EMPTY_BODY),
        title: input.title ?? null,
        created_at: at,
        updated_at: at,
      };
      pages.set(page.id, page);
      return ok(page);
    },

    async renamePage(writer, { pageId, title }) {
      return editPage(writer, pageId, (page) => {
        page.title = title;
      });
    },

    async reorderPages(writer, { chapterId, pageIds }) {
      const chapter = findChapter(writer, chapterId);
      if (!chapter) return NOT_FOUND;
      if (!applyOrder(pagesOf(chapter.id), pageIds)) return INVALID_ORDER;
      return ok(pagesOf(chapter.id).map(summaryOf));
    },

    async getPageForEdit(writer, { pageId }) {
      const page = findPage(writer, pageId);
      return page ? ok(page) : NOT_FOUND;
    },

    async savePageContent(writer, { pageId, body }) {
      return editPage(writer, pageId, (page) => {
        page.body = structuredClone(body);
      });
    },

    async setPageLanguage(writer, { pageId, language }) {
      return editPage(writer, pageId, (page) => {
        page.language = language;
      });
    },

    async publishPage(writer, { pageId }) {
      return editPage(writer, pageId, (page, at) => {
        if (page.status === "published") return;
        page.status = "published";
        page.published_at = at;
      });
    },

    async unpublishPage(writer, { pageId }) {
      return editPage(writer, pageId, (page) => {
        page.status = "draft";
        page.published_at = null;
      });
    },

    // Archiving keeps the first archived_at, like the database's apply_publication_state.
    async archivePage(writer, { pageId }) {
      const page = findPage(writer, pageId);
      if (!page) return NOT_FOUND;
      const at = timestamp();
      Object.assign(page, { archived_at: page.archived_at ?? at, updated_at: at });
      return ok(page);
    },

    async restorePage(writer, { pageId }) {
      const page = findPage(writer, pageId);
      if (!page) return NOT_FOUND;
      Object.assign(page, { archived_at: null, updated_at: timestamp() });
      return ok(page);
    },
  };
}
