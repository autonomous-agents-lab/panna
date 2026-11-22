import { z } from "zod";

import { TEXT_LIMITS } from "@/config/books";

import { bookSchema } from "./book";
import { nonBlankTextWithin, textWithin, timestampSchema } from "./fields";
import { languageSchema } from "./language";
import { usernameSchema } from "./username";

/** A row of `public.profiles`. Keys are exactly the table's columns; there is no email or auth data. */
export const profileSchema = z.strictObject({
  id: z.uuid(),
  username: usernameSchema,
  display_name: nonBlankTextWithin(TEXT_LIMITS.displayName),
  avatar_path: textWithin(TEXT_LIMITS.avatarPath).nullable(),
  bio: textWithin(TEXT_LIMITS.bio).nullable(),
  preferred_language: languageSchema,
  username_changed_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deactivated_at: timestampSchema.nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * `rpc("create_profile_with_book", args)` arguments. Keys are the function's parameters. The
 * username is trimmed and lowercased here, as the function does; the reserved list and history
 * holds are checked by `validateUsername` in src/lib/username and again by the function.
 */
export const createProfileWithBookInputSchema = z.strictObject({
  p_username: z.string().trim().toLowerCase().pipe(usernameSchema),
  p_display_name: z.string().trim().pipe(nonBlankTextWithin(TEXT_LIMITS.displayName)),
  p_preferred_language: languageSchema,
});

export type CreateProfileWithBookInput = z.input<typeof createProfileWithBookInputSchema>;

/** `rpc("create_profile_with_book")` response: the new profile and its one book. */
export const createProfileWithBookResultSchema = z.strictObject({
  profile: profileSchema,
  book: bookSchema,
});

export type CreateProfileWithBookResult = z.infer<typeof createProfileWithBookResultSchema>;
