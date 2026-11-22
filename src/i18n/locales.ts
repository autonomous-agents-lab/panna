import { z } from "zod";

/**
 * Supported locales are a product constant, not deployment config: adding one means adding a
 * catalogue in `messages/`, which is a code change.
 */
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The cookie that remembers a visitor's choice of language. */
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const localeSchema = z.enum(LOCALES);

export function isLocale(value: unknown): value is Locale {
  return localeSchema.safeParse(value).success;
}
