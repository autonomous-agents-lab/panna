import { z } from "zod";

import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/config/usernames";

import { timestampSchema } from "./fields";

/** Why a username can't be used. Each maps to a Hindi and an English message. */
export const USERNAME_ERROR_CODES = [
  "too_short",
  "too_long",
  "invalid_characters",
  "must_start_with_letter",
  "reserved",
  "held",
  "taken",
] as const;

export type UsernameErrorCode = (typeof USERNAME_ERROR_CODES)[number];

/** The stored form: lowercase, a letter first, then letters, digits or underscores. Same as the DB check. */
export const USERNAME_PATTERN = new RegExp(
  `^[a-z][a-z0-9_]{${USERNAME_MIN_LENGTH - 1},${USERNAME_MAX_LENGTH - 1}}$`,
);

export const usernameSchema = z.string().regex(USERNAME_PATTERN);

/** `rpc("username_held_until", { p_username })` response: when the name is free again, or null if it isn't held. */
export const usernameHeldUntilResultSchema = timestampSchema.nullable();
