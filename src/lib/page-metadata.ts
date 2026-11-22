import type { Metadata } from "next";

import { config } from "@/config";
import type { MessageKey } from "@/i18n";
import { getTranslator } from "@/i18n/server";

import { buildMetadata } from "./metadata";

/** `buildMetadata` for the current request: configured app name and site URL, request locale. */
export async function pageMetadata({
  path,
  titleKey,
  noindex,
}: { path?: string; titleKey?: MessageKey; noindex?: boolean } = {}): Promise<Metadata> {
  const { locale, t } = await getTranslator();
  return buildMetadata({
    appName: config.appName,
    siteUrl: config.siteUrl,
    description: t("shell.description"),
    locale,
    path,
    title: titleKey && t(titleKey),
    noindex,
  });
}
