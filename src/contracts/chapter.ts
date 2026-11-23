import { z } from "zod";

import { TEXT_LIMITS } from "@/config/books";

import { contentStatusSchema, positionSchema } from "./content-status";
import { nonBlankTextWithin, timestampSchema } from "./fields";
import { languageSchema } from "./language";

/** A row of `public.chapters`. Keys are exactly the table's columns. */
export const chapterSchema = z.strictObject({
  id: z.uuid(),
  book_id: z.uuid(),
  position: positionSchema,
  title: nonBlankTextWithin(TEXT_LIMITS.chapterTitle),
  status: contentStatusSchema,
  published_at: timestampSchema.nullable(),
  archived_at: timestampSchema.nullable(),
  language: languageSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export type Chapter = z.infer<typeof chapterSchema>;

const chapterTitleInputSchema = z.string().trim().pipe(nonBlankTextWithin(TEXT_LIMITS.chapterTitle));

/** `from("chapters").insert(input)`: exactly the columns clients may insert. status defaults to draft. */
export const createChapterInputSchema = z.strictObject({
  book_id: z.uuid(),
  position: positionSchema,
  title: chapterTitleInputSchema,
  status: contentStatusSchema.optional(),
  language: languageSchema,
});

export type CreateChapterInput = z.input<typeof createChapterInputSchema>;

/**
 * `from("chapters").update(input)`: the columns clients may update. Any archived_at archives the
 * chapter and null restores it; the database stamps the time itself.
 */
export const updateChapterInputSchema = z
  .strictObject({
    position: positionSchema,
    title: chapterTitleInputSchema,
    status: contentStatusSchema,
    language: languageSchema,
    archived_at: timestampSchema.nullable(),
  })
  .partial();

export type UpdateChapterInput = z.input<typeof updateChapterInputSchema>;
