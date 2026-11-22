import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));

vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { default: HomePage, generateMetadata } = await import("./page");

describe("HomePage", () => {
  it.each(["en", "hi"] as const)("in %s, shows the app name and the translated tagline, with no main of its own", async (current) => {
    locale.current = current;
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toBe(`<h1>${config.appName}</h1><p>${catalogues[current]["home.tagline"]}</p>`);
  });

  it("is canonical at the site root", async () => {
    const metadata = await generateMetadata();
    expect(metadata.alternates).toEqual({ canonical: "/" });
    expect(metadata.openGraph).toMatchObject({ url: "/", siteName: config.appName });
    expect(metadata).not.toHaveProperty("robots");
  });
});
