import type { Metadata } from "next";

import { config } from "@/config";
import type { MessageKey, MessageValues } from "@/i18n";
import { getTranslator } from "@/i18n/server";

import { buildMetadata } from "./metadata";

/**
 * `buildMetadata` for the current request: configured app name and site URL, request locale.
 * `titleValues` fill the title message's `{placeholders}`.
 */
export async function pageMetadata({
  path,
  titleKey,
  titleValues,
  noindex,
}: { path?: string; titleKey?: MessageKey; titleValues?: MessageValues; noindex?: boolean } = {}): Promise<Metadata> {
  const { locale, t } = await getTranslator();
  return buildMetadata({
    appName: config.appName,
    siteUrl: config.siteUrl,
    description: t("shell.description"),
    locale,
    path,
    title: titleKey && t(titleKey, titleValues),
    noindex,
  });
}

/** The 404 page's metadata. It can't see the requested path, so the canonical is the home page it links to. */
export function notFoundMetadata(): Promise<Metadata> {
  return pageMetadata({ path: "/", titleKey: "notFound.title", noindex: true });
}
