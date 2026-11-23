import { z } from "zod";

import { TEXT_LIMITS } from "@/config/books";

import { coverStyleSchema, fontIdSchema } from "./book-options";
import { nonBlankTextWithin, textWithin, timestampSchema } from "./fields";
import { languageSchema } from "./language";

/** A row of `public.books`. Keys are exactly the table's columns. */
export const bookSchema = z.strictObject({
  id: z.uuid(),
  owner_id: z.uuid(),
  title: nonBlankTextWithin(TEXT_LIMITS.bookTitle),
  subtitle: textWithin(TEXT_LIMITS.bookSubtitle).nullable(),
  cover_style: coverStyleSchema,
  font: fontIdSchema,
  default_language: languageSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export type Book = z.infer<typeof bookSchema>;
