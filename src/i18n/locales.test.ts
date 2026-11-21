import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES } from "./locales";

describe("locales", () => {
  it("supports English and Hindi, defaulting to English", () => {
    expect(LOCALES).toEqual(["en", "hi"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALE_COOKIE).toBe("locale");
  });

  it.each([
    ["en", true],
    ["hi", true],
    ["HI", false],
    ["hi-IN", false],
    ["", false],
    [undefined, false],
    [1, false],
  ])("isLocale(%j) is %s", (value, expected) => {
    expect(isLocale(value)).toBe(expected);
  });
});
