import type { z } from "zod";

import { bookSchema } from "./book";
import { profileSchema } from "./profile";

/**
 * What anyone may see of a writer's book at /<username>: the public profile fields and the book's
 * cover details. The placeholder page reads it now; the reader epic builds on it.
 */
export const publicBookSchema = profileSchema
  .pick({ username: true, display_name: true, bio: true, avatar_path: true })
  .extend({ book: bookSchema.pick({ title: true, subtitle: true, default_language: true }) });

export type PublicBook = z.infer<typeof publicBookSchema>;

/** The PostgREST select that returns a `PublicBook` from `profiles` (books.owner_id is unique, so `book` is one object). */
export const PUBLIC_BOOK_SELECT = "username, display_name, bio, avatar_path, book:books(title, subtitle, default_language)";
