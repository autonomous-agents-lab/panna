import { describe, expect, it } from "vitest";

import { resolveLocale } from "./resolve-locale";

describe("resolveLocale", () => {
  it.each(["en", "hi"] as const)("uses a valid %s cookie over the browser's preference", (locale) => {
    expect(resolveLocale({ cookieValue: locale, acceptLanguage: locale === "en" ? "hi" : "en" })).toBe(locale);
  });

  it.each([undefined, null, ""])("negotiates from Accept-Language when the cookie is %j", (cookieValue) => {
    expect(resolveLocale({ cookieValue, acceptLanguage: "hi-IN,hi;q=0.9,en;q=0.8" })).toBe("hi");
    expect(resolveLocale({ cookieValue, acceptLanguage: "fr-FR" })).toBe("en");
    expect(resolveLocale({ cookieValue })).toBe("en");
  });

  it.each(["xx", "HI ", "Hi", " hi", "en;drop", "../..", "hi\u0000", "x".repeat(10_000), "{}", "__proto__"])(
    "falls back to English, without throwing, for the tampered cookie %j even when the browser prefers Hindi",
    (cookieValue) => {
      expect(() => resolveLocale({ cookieValue, acceptLanguage: "hi" })).not.toThrow();
      expect(resolveLocale({ cookieValue, acceptLanguage: "hi" })).toBe("en");
    },
  );

  it("works with no sources at all", () => {
    expect(resolveLocale({})).toBe("en");
  });
});
