import { z } from "zod";

import { contentStatusSchema, positionSchema } from "./content-status";
import { timestampSchema } from "./fields";
import { languageSchema } from "./language";
import { pageBodySchema, sanitisePageBody, type PageBodyOptions } from "./page-body";

/** A row of `public.pages`. Keys are exactly the table's columns. */
export const pageSchema = z.strictObject({
  id: z.uuid(),
  book_id: z.uuid(),
  chapter_id: z.uuid(),
  position: positionSchema,
  status: contentStatusSchema,
  published_at: timestampSchema.nullable(),
  archived_at: timestampSchema.nullable(),
  language: languageSchema,
  body: pageBodySchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export type Page = z.infer<typeof pageSchema>;

/**
 * A page body from a client: sanitised (docs/content-format.md), or failed with one issue whose
 * message is the sanitiser's error code and whose path points at the problem.
 */
export function pageBodyInputSchema(options: PageBodyOptions) {
  return z.unknown().transform((input, context) => {
    const result = sanitisePageBody(input, options);
    if (result.ok) return result.body;
    context.addIssue({ code: "custom", message: result.code, path: result.path, input });
    return z.NEVER;
  });
}

/** `from("pages").insert(input)`: exactly the columns clients may insert. status and body have defaults. */
export function createPageInputSchema(options: PageBodyOptions) {
  return z.strictObject({
    book_id: z.uuid(),
    chapter_id: z.uuid(),
    position: positionSchema,
    status: contentStatusSchema.optional(),
    language: languageSchema,
    body: pageBodyInputSchema(options).optional(),
  });
}

export type CreatePageInput = z.input<ReturnType<typeof createPageInputSchema>>;

/**
 * `from("pages").update(input)`: the columns clients may update. Any archived_at archives the
 * page and null restores it; the database stamps the time itself.
 */
export function updatePageInputSchema(options: PageBodyOptions) {
  return z
    .strictObject({
      chapter_id: z.uuid(),
      position: positionSchema,
      status: contentStatusSchema,
      language: languageSchema,
      archived_at: timestampSchema.nullable(),
      body: pageBodyInputSchema(options),
    })
    .partial();
}

export type UpdatePageInput = z.input<ReturnType<typeof updatePageInputSchema>>;
