// Server-safe, shared exports. Server Components also use `@/i18n/server`; Client Components use
// `@/i18n/client`. Nothing outside src/i18n imports the catalogues directly.
export { endonymOf, type MessageKey } from "./catalogue";
export { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "./locales";
export type { MessageValues, Translate } from "./translate";
