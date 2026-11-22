import { describe, expect, it } from "vitest";

import { theme } from "@/theme";

import { buildManifest } from "./manifest";

describe("buildManifest", () => {
  it("names the app with the configured name and uses the theme's paper tone", () => {
    expect(buildManifest({ appName: "Kitaab", description: "A digital book.", lang: "en" })).toEqual({
      name: "Kitaab",
      short_name: "Kitaab",
      description: "A digital book.",
      lang: "en",
      start_url: "/",
      display: "standalone",
      background_color: theme.color.paper,
      theme_color: theme.color.paper,
    });
  });
});
