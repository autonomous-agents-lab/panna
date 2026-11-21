import type { Metadata } from "next";
import type { ReactNode } from "react";

import { config } from "@/config";
import { renderRootCss, theme } from "@/theme";

import "./globals.css";

// Built only from the typed theme constants; renderRootCss rejects anything that could
// close the <style> element. Raw HTML keeps the font stacks' quotes from being escaped.
const rootCss = renderRootCss(theme);

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: config.appName,
  applicationName: config.appName,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: rootCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
