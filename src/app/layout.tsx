import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/shell/SiteHeader";
import { config } from "@/config";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getMessages } from "@/i18n/server";
import { renderRootCss, theme } from "@/theme";

import { fontVariables } from "./fonts";
import "./globals.css";

// Built only from the typed theme constants; renderRootCss rejects anything that could
// close the <style> element. Raw HTML keeps the font stacks' quotes from being escaped.
const rootCss = renderRootCss(theme);

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: config.appName,
  applicationName: config.appName,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale} className={fontVariables}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: rootCss }} />
      </head>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <SiteHeader />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
