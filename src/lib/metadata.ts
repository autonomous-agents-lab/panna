import type { Metadata } from "next";

import type { Locale } from "@/i18n";

export interface MetadataInput {
  appName: string;
  /** The configured public base URL; every relative URL below resolves against it. */
  siteUrl: string;
  description: string;
  locale: Locale;
  /** The page's own path, e.g. "/". Sets the canonical link and og:url when given. */
  path?: string;
  /** A translated page title, shown as "<title> · <appName>". Omit for the app name alone. */
  title?: string;
  noindex?: boolean;
}

const OPEN_GRAPH_LOCALES: Record<Locale, string> = { en: "en_IN", hi: "hi_IN" };

/**
 * The full metadata for a page. Next merges `openGraph`, `twitter` and `alternates` shallowly,
 * so a page that set only part of them would drop the rest from the layout; every page calls
 * this instead and gets complete objects.
 */
export function buildMetadata({
  appName,
  siteUrl,
  description,
  locale,
  path,
  title,
  noindex = false,
}: MetadataInput): Metadata {
  const fullTitle = title === undefined ? appName : `${title} · ${appName}`;
  return {
    metadataBase: new URL(siteUrl),
    applicationName: appName,
    title: title === undefined ? { default: appName, template: `%s · ${appName}` } : { absolute: fullTitle },
    description,
    ...(path === undefined ? {} : { alternates: { canonical: path } }),
    openGraph: {
      siteName: appName,
      title: fullTitle,
      description,
      locale: OPEN_GRAPH_LOCALES[locale],
      type: "website",
      ...(path === undefined ? {} : { url: path }),
    },
    twitter: { card: "summary", title: fullTitle, description },
    manifest: "/manifest.webmanifest",
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
