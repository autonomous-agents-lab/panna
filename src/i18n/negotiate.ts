import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/** Only this much of the header is read, so an oversized header cannot cost much CPU. */
export const MAX_ACCEPT_LANGUAGE_LENGTH = 512;

const LANGUAGE_RANGE = /^(?:\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)$/;
const QUALITY = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

export interface LanguagePreference {
  /** Lower-cased language range, e.g. `"hi-in"` or `"*"`. */
  tag: string;
  q: number;
}

/**
 * Parses an `Accept-Language` header into preferences, most preferred first. Entries with an
 * invalid tag or quality, and entries with `q=0`, are dropped; equal qualities keep header order.
 */
export function parseAcceptLanguage(header: string | null | undefined): LanguagePreference[] {
  if (!header) return [];
  const preferences = header
    .slice(0, MAX_ACCEPT_LANGUAGE_LENGTH)
    .split(",")
    .flatMap((entry): LanguagePreference[] => {
      const [range, ...params] = entry
        .split(";")
        .map((part) => part.trim().toLowerCase()) as [string, ...string[]];
      if (!LANGUAGE_RANGE.test(range)) return [];
      let q = 1;
      for (const param of params) {
        const match = QUALITY.exec(param.replace(/\s+/g, ""));
        if (!match) return [];
        q = Number(match[1]);
      }
      return q > 0 ? [{ tag: range, q }] : [];
    });
  return preferences.sort((a, b) => b.q - a.q);
}

/**
 * The supported locale the header prefers most, matched on the primary subtag (`hi-IN` → `hi`).
 * A wildcard means any language will do, so it resolves to the default.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  for (const { tag } of parseAcceptLanguage(header)) {
    if (tag === "*") return DEFAULT_LOCALE;
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
