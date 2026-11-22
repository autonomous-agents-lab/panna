import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { MAIN_ID, SkipLink } from "@/components/shell/SkipLink";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getMessages } from "@/i18n/server";
import { pageMetadata } from "@/lib/page-metadata";
import { renderRootCss, theme } from "@/theme";

import { fontVariables } from "./fonts";
import "./globals.css";

// Built only from the typed theme constants; renderRootCss rejects anything that could
// close the <style> element. Raw HTML keeps the font stacks' quotes from being escaped.
const rootCss = renderRootCss(theme);

// Site-wide defaults. No canonical here: each page sets its own path, so a page that forgot
// would have none rather than silently pointing search engines at the home page.
export function generateMetadata() {
  return pageMetadata();
}

/** Every page renders inside the one `<main>`; pages must not add another. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale} className={fontVariables}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: rootCss }} />
      </head>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <SkipLink />
          <SiteHeader />
          <main id={MAIN_ID} tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
