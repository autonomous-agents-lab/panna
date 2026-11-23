import { z } from "zod";

import { TEXT_LIMITS } from "@/config/books";
import { PAGE_TITLE_LIMIT } from "@/config/writing";

import type { Chapter } from "./chapter";
import type { CurrentWriter } from "./current-writer";
import { nonBlankTextWithin } from "./fields";
import { languageSchema } from "./language";
import { pageBodyInputSchema, type Page } from "./page";
import { sanitisePageBody, type PageBody, type PageBodyOptions } from "./page-body";

// The writing epic's contract. Chapter, Page and the body format are BOOK-19's, reused unchanged.

export type { Chapter } from "./chapter";
export type { Page } from "./page";

/** The rich-text document a page holds: BOOK-19's page body (docs/content-format.md). */
export type RichTextDocument = PageBody;

/** The same function as sanitisePageBody, under the writing epic's name. There is one set of rules. */
export const sanitiseRichText = sanitisePageBody;

/** A page as the writer sees it. Archived always wins over the row's draft/published status. */
export const PAGE_STATUSES = ["draft", "published", "archived"] as const;

export const pageStatusSchema = z.enum(PAGE_STATUSES);

export type PageStatus = z.infer<typeof pageStatusSchema>;

/** A page's status: archived while archived_at is set, otherwise the status it had (draft or published). */
export function pageStatusOf(page: Pick<Page, "status" | "archived_at">): PageStatus {
  return page.archived_at === null ? page.status : "archived";
}

/** A page with its optional title. The pages table gets a title column in its own contract story. */
export type WritingPage = Page & { title: string | null };

/** A page in a chapter list: everything but the body. */
export type PageSummary = Pick<WritingPage, "id" | "chapter_id" | "position" | "title" | "language" | "updated_at"> & {
  status: PageStatus;
};

export type ChapterWithPages = Chapter & { pages: PageSummary[] };

export const WRITING_ERROR_CODES = ["not_found", "invalid_input", "invalid_order", "page_archived"] as const;

export type WritingErrorCode = (typeof WRITING_ERROR_CODES)[number];

/**
 * Why a repository call changed nothing. not_found also covers another writer's ids, so a caller
 * can't tell whether they exist. invalid_input carries the zod issues.
 */
export type WritingFailure =
  | { ok: false; error: "invalid_input"; issues: z.core.$ZodIssue[] }
  | { ok: false; error: Exclude<WritingErrorCode, "invalid_input"> };

export type WritingResult<T> = { ok: true; value: T } | WritingFailure;

const chapterTitleSchema = z.string().trim().pipe(nonBlankTextWithin(TEXT_LIMITS.chapterTitle));
const pageTitleSchema = z.string().trim().pipe(nonBlankTextWithin(PAGE_TITLE_LIMIT));

/** Every id of a chapter's pages or a book's chapters, in the new order. */
const idOrderSchema = z
  .array(z.uuid())
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, { message: "Must not repeat an id" });

const pageIdSchema = z.strictObject({ pageId: z.uuid() });

const newPageFields = { language: languageSchema, title: pageTitleSchema.optional() };

/**
 * The input of every repository method, by method name. A body needs the storage URL to check
 * image srcs, so the schemas are made per options, like BOOK-19's createPageInputSchema.
 */
export function writingInputSchemas(options: PageBodyOptions) {
  return {
    createChapter: z.strictObject({ title: chapterTitleSchema, language: languageSchema }),
    renameChapter: z.strictObject({ chapterId: z.uuid(), title: chapterTitleSchema }),
    reorderChapters: z.strictObject({ chapterIds: idOrderSchema }),
    /**
     * Into the given chapter, or else into the book's last chapter. A book without chapters first
     * gets one called firstChapterTitle, which the caller translates, so no UI text lives here.
     */
    createPage: z.union([
      z.strictObject({ chapterId: z.uuid(), ...newPageFields }),
      z.strictObject({ firstChapterTitle: chapterTitleSchema, ...newPageFields }),
    ]),
    /** null removes the title. */
    renamePage: z.strictObject({ pageId: z.uuid(), title: pageTitleSchema.nullable() }),
    reorderPages: z.strictObject({ chapterId: z.uuid(), pageIds: idOrderSchema }),
    getPageForEdit: pageIdSchema,
    savePageContent: z.strictObject({ pageId: z.uuid(), body: pageBodyInputSchema(options) }),
    setPageLanguage: z.strictObject({ pageId: z.uuid(), language: languageSchema }),
    publishPage: pageIdSchema,
    unpublishPage: pageIdSchema,
    archivePage: pageIdSchema,
    restorePage: pageIdSchema,
  };
}

export type WritingInputSchemas = ReturnType<typeof writingInputSchemas>;

/** Validated (and, for bodies, sanitised) input of each repository method. */
export type WritingInput = { [Method in keyof WritingInputSchemas]: z.output<WritingInputSchemas[Method]> };

/**
 * Chapters and pages of the current writer's book. Every call is scoped to `writer`: another
 * writer's ids give not_found and change nothing. Expected failures come back as a WritingResult;
 * only infrastructure errors (e.g. a database outage) throw.
 */
export interface WritingRepository {
  /** Every chapter by position, each with its pages by position, archived ones included. */
  listChapters(writer: CurrentWriter): Promise<WritingResult<ChapterWithPages[]>>;
  createChapter(writer: CurrentWriter, input: WritingInput["createChapter"]): Promise<WritingResult<Chapter>>;
  renameChapter(writer: CurrentWriter, input: WritingInput["renameChapter"]): Promise<WritingResult<Chapter>>;
  /** chapterIds must be exactly the book's chapters; positions become 0..n-1. */
  reorderChapters(writer: CurrentWriter, input: WritingInput["reorderChapters"]): Promise<WritingResult<Chapter[]>>;
  createPage(writer: CurrentWriter, input: WritingInput["createPage"]): Promise<WritingResult<WritingPage>>;
  renamePage(writer: CurrentWriter, input: WritingInput["renamePage"]): Promise<WritingResult<WritingPage>>;
  /** pageIds must be exactly the chapter's pages, archived ones included; positions become 0..n-1. */
  reorderPages(writer: CurrentWriter, input: WritingInput["reorderPages"]): Promise<WritingResult<PageSummary[]>>;
  getPageForEdit(writer: CurrentWriter, input: WritingInput["getPageForEdit"]): Promise<WritingResult<WritingPage>>;
  savePageContent(writer: CurrentWriter, input: WritingInput["savePageContent"]): Promise<WritingResult<WritingPage>>;
  setPageLanguage(writer: CurrentWriter, input: WritingInput["setPageLanguage"]): Promise<WritingResult<WritingPage>>;
  publishPage(writer: CurrentWriter, input: WritingInput["publishPage"]): Promise<WritingResult<WritingPage>>;
  unpublishPage(writer: CurrentWriter, input: WritingInput["unpublishPage"]): Promise<WritingResult<WritingPage>>;
  archivePage(writer: CurrentWriter, input: WritingInput["archivePage"]): Promise<WritingResult<WritingPage>>;
  /** Brings the page back with the draft or published status it had before. */
  restorePage(writer: CurrentWriter, input: WritingInput["restorePage"]): Promise<WritingResult<WritingPage>>;
}
