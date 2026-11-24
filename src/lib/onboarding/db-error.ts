import type { DbError } from "@/lib/username";

/** `create_profile_with_book` failed because the caller already has a profile (its primary key is the user id). */
export function isDuplicateProfileError(error: DbError | null | undefined): boolean {
  return error?.code === "23505" && (error.message?.includes('"profiles_pkey"') ?? false);
}
