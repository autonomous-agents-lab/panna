"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Catalogue } from "./catalogue";
import type { Locale } from "./locales";
import { createTranslator, type Translate } from "./translate";

interface I18nValue {
  locale: Locale;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Catalogue;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createTranslator(messages) }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useTranslator and useLocale must be used inside I18nProvider");
  return value;
}

/** For Client Components: `t` bound to the current locale's catalogue. */
export function useTranslator(): Translate {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
