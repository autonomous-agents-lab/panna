import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));

vi.mock("@/i18n/set-locale", () => ({ setLocale: async () => {} }));
vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { SiteHeader } = await import("./SiteHeader");

describe("SiteHeader", () => {
  it.each([
    ["en", `${config.appName}, home`, "Language"],
    ["hi", `${config.appName}, मुखपृष्ठ`, "भाषा"],
  ] as const)("in %s, links home and offers the locale switch in that language", async (current, home, label) => {
    locale.current = current;
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toContain(`href="/"`);
    expect(html).toContain(`aria-label="${home}"`);
    expect(html).toContain(`>${config.appName}</a>`);
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${current === "en" ? "English" : "हिन्दी"}</button>`));
  });
});
