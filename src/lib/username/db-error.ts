import type { UsernameErrorCode } from "@/contracts/username";

/** The parts of a Postgres / PostgREST error this needs (e.g. a supabase-js `PostgrestError`). */
export interface DbError {
  code?: string;
  message?: string;
}

const UNIQUE_VIOLATION = "23505";
const RAISE_EXCEPTION = "P0001";

/**
 * Maps a database rejection of a username (from `create_profile_with_book`) to the same codes the
 * validator uses, so the UI shows one set of messages. Returns null for any other error.
 */
export function usernameErrorFromDb(error: DbError | null | undefined): UsernameErrorCode | null {
  if (!error) return null;
  if (error.code === UNIQUE_VIOLATION && error.message?.includes("profiles_username_lower_key")) {
    return "taken";
  }
  if (error.code === RAISE_EXCEPTION && error.message === "username_held") return "held";
  if (error.code === RAISE_EXCEPTION && error.message === "username_reserved") return "reserved";
  return null;
}
