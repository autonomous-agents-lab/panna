import type { Metadata } from "next";
import type { ReactNode } from "react";

import { config } from "@/config";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: config.appName,
  applicationName: config.appName,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
