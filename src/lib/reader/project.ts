import { z } from "zod";

import {
  bookSchema,
  chapterSchema,
  pageSchema,
  profileSchema,
  readerBookSchema,
  readerPageViewSchema,
  type Book,
  type Chapter,
  type Page,
  type Profile,
  type ReaderBook,
  type ReaderPageView,
  type ReaderWriter,
} from "@/contracts";

/** Rows as the tables hold them, for the in-memory stand-in. */
export const bookStoreSchema = z.strictObject({
  profiles: z.array(profileSchema),
  books: z.array(bookSchema),
  chapters: z.array(chapterSchema),
  pages: z.array(pageSchema),
});

export type BookStore = z.infer<typeof bookStoreSchema>;

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** Readers see a page only when it is published, has a publish date and isn't archived. */
export function isPublished(page: Page): boolean {
  return page.status === "published" && page.published_at !== null && page.archived_at === null;
}

/** The active writer with this username and their book. A deactivated writer counts as missing. */
function findWriterBook(store: BookStore, username: string): { profile: Profile; book: Book } | null {
  const profile = store.profiles.find((row) => row.username === username && row.deactivated_at === null);
  const book = profile && store.books.find((row) => row.owner_id === profile.id);
  return profile && book ? { profile, book } : null;
}

function liveChapters(store: BookStore, bookId: string): Chapter[] {
  return store.chapters.filter((row) => row.book_id === bookId && row.archived_at === null).sort(byPosition);
}

function publishedPages(store: BookStore, chapterId: string): Page[] {
  return store.pages.filter((row) => row.chapter_id === chapterId && isPublished(row)).sort(byPosition);
}

// The stand-in has no storage to resolve `avatar_path` against, so it shows no photo.
function toWriter({ username, display_name, bio }: Profile): ReaderWriter {
  return { username, display_name, bio, photo_url: null };
}

function toBookInfo({ id, title, subtitle, cover_style, font, default_language }: Book) {
  return { id, title, subtitle, cover_style, font, default_language };
}

// published_at is still nullable here; the reader schema checks it is set.
function toPage({ id, title, language, content, published_at }: Page) {
  return { id, title, language, content, published_at };
}

/** The writer's book with only published pages, chapters and pages in order; empty chapters are left out. */
export function toReaderBook(store: BookStore, username: string): ReaderBook | null {
  const found = findWriterBook(store, username);
  if (!found) return null;
  const chapters = liveChapters(store, found.book.id)
    .map(({ id, title }) => ({ id, title, pages: publishedPages(store, id).map(toPage) }))
    .filter((chapter) => chapter.pages.length > 0);
  return readerBookSchema.parse({ writer: toWriter(found.profile), book: toBookInfo(found.book), chapters });
}

/** One published page of the writer's own book, with its chapter; null for anything else. */
export function toReaderPage(store: BookStore, username: string, pageId: string): ReaderPageView | null {
  const found = findWriterBook(store, username);
  if (!found) return null;
  const page = store.pages.find((row) => row.id === pageId && isPublished(row));
  // A page id from another writer's book, or from an archived chapter, matches no live chapter here.
  const chapter = page && liveChapters(store, found.book.id).find((row) => row.id === page.chapter_id);
  if (!page || !chapter) return null;
  return readerPageViewSchema.parse({
    writer: toWriter(found.profile),
    book: toBookInfo(found.book),
    chapter: { id: chapter.id, title: chapter.title },
    page: toPage(page),
  });
}
