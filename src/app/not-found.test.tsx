import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));

vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { default: NotFound, generateMetadata } = await import("./not-found");

describe("NotFound", () => {
  it.each(["en", "hi"] as const)("in %s, explains in that language and links home", async (current) => {
    locale.current = current;
    const t = catalogues[current];
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain(`<h1>${t["notFound.title"]}</h1>`);
    expect(html).toContain(`<p>${t["notFound.body"]}</p>`);
    expect(html).toContain(`<a href="/">${t["notFound.home"]}</a>`);
  });

  it.each(["en", "hi"] as const)("in %s, is noindex with a translated, branded title", async (current) => {
    locale.current = current;
    const metadata = await generateMetadata();
    const title = `${catalogues[current]["notFound.title"]} · ${config.appName}`;
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.openGraph).toMatchObject({ title, siteName: config.appName });
  });
});
