import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/config/usernames";
import type { UsernameErrorCode } from "@/contracts/username";
import type { MessageKey, MessageValues } from "@/i18n";

const MESSAGE_KEYS = {
  too_short: "username.error.too_short",
  too_long: "username.error.too_long",
  invalid_characters: "username.error.invalid_characters",
  must_start_with_letter: "username.error.must_start_with_letter",
  reserved: "username.error.reserved",
  held: "username.error.held",
  taken: "username.error.taken",
} as const satisfies Record<UsernameErrorCode, MessageKey>;

/** The i18n key and placeholder values for a username error, ready for `t(key, values)`. */
export function usernameErrorMessage(code: UsernameErrorCode): { key: MessageKey; values: MessageValues } {
  return {
    key: MESSAGE_KEYS[code],
    values: { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH },
  };
}
