import type { MetadataRoute } from "next";

import { config } from "@/config";
import { DEFAULT_LOCALE, translatorFor } from "@/i18n";
import { buildManifest } from "@/lib/manifest";

// The manifest isn't per request, so it is always in the default language.
export default function manifest(): MetadataRoute.Manifest {
  return buildManifest({
    appName: config.appName,
    description: translatorFor(DEFAULT_LOCALE)("shell.description"),
    lang: DEFAULT_LOCALE,
  });
}
