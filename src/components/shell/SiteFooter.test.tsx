import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));

vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { SiteFooter } = await import("./SiteFooter");

describe("SiteFooter", () => {
  it.each([
    ["en", `${config.appName}: a digital book for everyone`],
    ["hi", `${config.appName}: सबके लिए एक डिजिटल किताब`],
  ] as const)("in %s, is a footer naming the app in that language", async (current, line) => {
    locale.current = current;
    const html = renderToStaticMarkup(await SiteFooter());
    expect(html).toMatch(/^<footer class="[^"]*"><p>/);
    expect(html).toContain(`<p>${line}</p>`);
  });
});
