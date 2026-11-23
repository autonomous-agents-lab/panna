import { describe, expect, it } from "vitest";

import { USERNAME_ERROR_CODES } from "@/contracts/username";
import { translatorFor } from "@/i18n";
import { en } from "@/i18n/messages/en";
import { hi } from "@/i18n/messages/hi";

import { usernameErrorMessage } from "./messages";

describe("usernameErrorMessage", () => {
  it.each(USERNAME_ERROR_CODES)("maps %s to its own key in both catalogues", (code) => {
    const { key } = usernameErrorMessage(code);
    expect(key).toBe(`username.error.${code}`);
    expect(en[key]).toBeTruthy();
    expect(hi[key]).toBeTruthy();
  });

  it("fills the length limits from config in English and Hindi", () => {
    const tooShort = usernameErrorMessage("too_short");
    const tooLong = usernameErrorMessage("too_long");
    expect(translatorFor("en")(tooShort.key, tooShort.values)).toBe("Usernames need at least 3 characters.");
    expect(translatorFor("hi")(tooLong.key, tooLong.values)).toContain("30");
  });
});
