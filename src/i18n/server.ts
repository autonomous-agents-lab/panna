import { cookies, headers } from "next/headers";
import { cache } from "react";

import { catalogues, type Catalogue } from "./catalogue";
import { LOCALE_COOKIE, type Locale } from "./locales";
import { readRawCookie } from "./raw-cookie";
import { resolveLocale } from "./resolve-locale";
import { createTranslator, type Translate } from "./translate";

/** The locale of the current request, resolved once per render. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    // cookies() reflects a value the locale switch has just set; the raw header still shows a
    // cookie that cookies() discarded as undecodable, so it counts as invalid, not missing.
    cookieValue:
      cookieStore.get(LOCALE_COOKIE)?.value ?? readRawCookie(headerList.get("cookie"), LOCALE_COOKIE),
    acceptLanguage: headerList.get("accept-language"),
  });
});

/** For Server Components: the request's locale and a `t` bound to its catalogue. */
export async function getTranslator(): Promise<{ locale: Locale; t: Translate }> {
  const locale = await getLocale();
  return { locale, t: createTranslator(catalogues[locale]) };
}

/** The request's catalogue, to hand to `I18nProvider` for Client Components. */
export async function getMessages(): Promise<Catalogue> {
  return catalogues[await getLocale()];
}
