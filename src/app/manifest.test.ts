import { afterEach, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("names the app from NEXT_PUBLIC_APP_NAME with no code changes, described in the default language", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Kitaab");
  vi.resetModules();
  const { default: manifest } = await import("./manifest");

  expect(manifest()).toMatchObject({
    name: "Kitaab",
    short_name: "Kitaab",
    description: catalogues.en["shell.description"],
    lang: "en",
    start_url: "/",
  });
});
