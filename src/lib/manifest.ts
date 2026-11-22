import type { MetadataRoute } from "next";

import { theme } from "@/theme";

/** The web app manifest. Ships without icons until the branding work provides them. */
export function buildManifest({
  appName,
  description,
  lang,
}: {
  appName: string;
  description: string;
  lang: string;
}): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName,
    description,
    lang,
    start_url: "/",
    display: "standalone",
    background_color: theme.color.paper,
    theme_color: theme.color.paper,
  };
}
