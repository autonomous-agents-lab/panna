import { z } from "zod";

import { PAGE_TEXT_LIMITS } from "@/config/pages";

import { nonBlankTextWithin, timestampSchema } from "./fields";

/**
 * A row of `public.chapters` (the table arrives with BOOK-19, which reuses this shape). Chapters
 * are ordered by `position` within their book and soft-deleted with `archived_at`.
 */
export const chapterSchema = z.strictObject({
  id: z.uuid(),
  book_id: z.uuid(),
  title: nonBlankTextWithin(PAGE_TEXT_LIMITS.chapterTitle),
  position: z.int().nonnegative(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  archived_at: timestampSchema.nullable(),
});

export type Chapter = z.infer<typeof chapterSchema>;
