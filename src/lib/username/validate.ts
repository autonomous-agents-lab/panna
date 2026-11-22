import { RESERVED_USERNAMES, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/config/usernames";
import type { UsernameErrorCode } from "@/contracts/username";

export type UsernameValidation =
  | { ok: true; username: string }
  | { ok: false; code: UsernameErrorCode };

export interface ValidateUsernameOptions {
  /** Names nobody can claim. Defaults to the configured list. */
  reserved?: readonly string[];
  /** When a released name becomes free again (`username_held_until`), or null if it isn't held. */
  heldUntil?: Date | null;
  now?: Date;
}

/** Usernames are case-folded: "  Asha " and "asha" are the same name. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Checks a username against every rule the app can know without asking whether it's taken.
 * Rules run in a fixed order, so the first one that fails decides the code.
 */
export function validateUsername(
  raw: string,
  { reserved = RESERVED_USERNAMES, heldUntil = null, now = new Date() }: ValidateUsernameOptions = {},
): UsernameValidation {
  const username = normalizeUsername(raw);
  // Code points, the way Postgres char_length counts them.
  const length = [...username].length;

  if (length < USERNAME_MIN_LENGTH) return { ok: false, code: "too_short" };
  if (length > USERNAME_MAX_LENGTH) return { ok: false, code: "too_long" };
  if (!/^[a-z0-9_]+$/.test(username)) return { ok: false, code: "invalid_characters" };
  if (!/^[a-z]/.test(username)) return { ok: false, code: "must_start_with_letter" };
  if (reserved.includes(username)) return { ok: false, code: "reserved" };
  if (heldUntil && heldUntil.getTime() > now.getTime()) return { ok: false, code: "held" };
  return { ok: true, username };
}
