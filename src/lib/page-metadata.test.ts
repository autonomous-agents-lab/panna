import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));

vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  locale.current = "en";
});

/** Imports a fresh module, so config is read from the env as stubbed at that moment. */
async function load(env: Record<string, string> = {}) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return (await import("./page-metadata")).pageMetadata;
}

describe("pageMetadata", () => {
  it("uses the configured app name and site URL", async () => {
    const pageMetadata = await load({ NEXT_PUBLIC_APP_NAME: "Kitaab", NEXT_PUBLIC_SITE_URL: "https://example.org" });
    const metadata = await pageMetadata({ path: "/" });
    expect(metadata.title).toEqual({ default: "Kitaab", template: "%s · Kitaab" });
    expect(String(metadata.metadataBase)).toBe("https://example.org/");
    expect(metadata.alternates).toEqual({ canonical: "/" });
  });

  it("describes the site in the request's language", async () => {
    const pageMetadata = await load();
    locale.current = "hi";
    const metadata = await pageMetadata();
    expect(metadata.description).toBe(catalogues.hi["shell.description"]);
    expect(metadata.openGraph).toMatchObject({ locale: "hi_IN" });
    expect(metadata).not.toHaveProperty("alternates");
    expect(metadata).not.toHaveProperty("robots");
  });

  it("translates a page title and passes noindex through", async () => {
    const pageMetadata = await load({ NEXT_PUBLIC_APP_NAME: "Kitaab" });
    locale.current = "hi";
    const metadata = await pageMetadata({ titleKey: "notFound.title", noindex: true });
    expect(metadata.title).toEqual({ absolute: `${catalogues.hi["notFound.title"]} · Kitaab` });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("fills the title's placeholders from titleValues", async () => {
    const pageMetadata = await load({ NEXT_PUBLIC_APP_NAME: "Kitaab" });
    const metadata = await pageMetadata({
      titleKey: "reader.documentTitle",
      titleValues: { bookTitle: "Rain", writerName: "Asha" },
    });
    expect(metadata.title).toEqual({ absolute: "Rain by Asha · Kitaab" });
  });
});
