import { z } from "zod";

import { PAGE_STATUSES, PAGE_TEXT_LIMITS } from "@/config/pages";

import { nonBlankTextWithin, timestampSchema } from "./fields";
import { languageSchema } from "./language";
import { richTextDocSchema } from "./rich-text";

export const pageStatusSchema = z.enum(PAGE_STATUSES);
export type PageStatus = z.infer<typeof pageStatusSchema>;

/**
 * A row of `public.pages` (the table arrives with BOOK-19, which reuses this shape). Pages are
 * ordered by `position` within their chapter, each has its own language, and they are
 * soft-deleted with `archived_at`. Readers see a page only when it is published, has a
 * `published_at` and is not archived.
 */
export const pageSchema = z.strictObject({
  id: z.uuid(),
  chapter_id: z.uuid(),
  title: nonBlankTextWithin(PAGE_TEXT_LIMITS.pageTitle).nullable(),
  language: languageSchema,
  content: richTextDocSchema,
  position: z.int().nonnegative(),
  status: pageStatusSchema,
  published_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  archived_at: timestampSchema.nullable(),
});

export type Page = z.infer<typeof pageSchema>;
