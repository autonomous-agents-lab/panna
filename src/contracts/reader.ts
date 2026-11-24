import { z } from "zod";

import { bookSchema } from "./book";
import { chapterSchema } from "./chapter";
import { pageSchema } from "./page";
import { profileSchema } from "./profile";
import { timestampSchema } from "./fields";

// What a reader is shown of a writer's book: published pages only, nothing private. Keys are
// picked from the row contracts so they keep the rows' names.

/** The writer, as a reader sees them. `photo_url` is an absolute URL the source resolves from `avatar_path`. */
export const readerWriterSchema = profileSchema
  .pick({ username: true, display_name: true, bio: true })
  .extend({ photo_url: z.url({ protocol: /^https?$/ }).nullable() });

export const readerBookInfoSchema = bookSchema.pick({
  id: true,
  title: true,
  subtitle: true,
  cover_style: true,
  font: true,
  default_language: true,
});

/** A published page. `body` is the sanitised page body (docs/content-format.md). */
export const readerPageSchema = pageSchema
  .pick({ id: true, language: true, body: true })
  .extend({ published_at: timestampSchema });

export const readerChapterSummarySchema = chapterSchema.pick({ id: true, title: true });

/** A chapter with its published pages in reading order. */
export const readerChapterSchema = readerChapterSummarySchema.extend({ pages: z.array(readerPageSchema) });

/** A writer's book as readers see it at `/<username>`: chapters and their pages in reading order. */
export const readerBookSchema = z.strictObject({
  writer: readerWriterSchema,
  book: readerBookInfoSchema,
  chapters: z.array(readerChapterSchema),
});

/** One published page as readers see it at `/<username>/<pageId>`, with its book and chapter. */
export const readerPageViewSchema = z.strictObject({
  writer: readerWriterSchema,
  book: readerBookInfoSchema,
  chapter: readerChapterSummarySchema,
  page: readerPageSchema,
});

export type ReaderWriter = z.infer<typeof readerWriterSchema>;
export type ReaderBookInfo = z.infer<typeof readerBookInfoSchema>;
export type ReaderPage = z.infer<typeof readerPageSchema>;
export type ReaderChapterSummary = z.infer<typeof readerChapterSummarySchema>;
export type ReaderChapter = z.infer<typeof readerChapterSchema>;
export type ReaderBook = z.infer<typeof readerBookSchema>;
export type ReaderPageView = z.infer<typeof readerPageViewSchema>;

/**
 * Where the reader gets books from. Routes depend only on this, so the data source (in-memory
 * today, Supabase later) can change without touching them. Both return null when nothing
 * matches: no such writer, a deactivated writer, or a page that isn't theirs or isn't published.
 * Page bodies must already be sanitised with sanitisePageBody.
 */
export interface BookSource {
  getPublishedBook(username: string): Promise<ReaderBook | null>;
  getPublishedPage(username: string, pageId: string): Promise<ReaderPageView | null>;
}
