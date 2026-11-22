import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
import { negotiateLocale } from "./negotiate";

export interface LocaleSources {
  /** The locale cookie as sent; absent or empty means the visitor has not chosen. */
  cookieValue?: string | null;
  acceptLanguage?: string | null;
}

/**
 * The locale for a request. A valid cookie wins; with no cookie, the browser's preference
 * decides. A cookie that is present but not a supported locale gives the default, never an error.
 */
export function resolveLocale({ cookieValue, acceptLanguage }: LocaleSources): Locale {
  if (!cookieValue) return negotiateLocale(acceptLanguage);
  return isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
}
