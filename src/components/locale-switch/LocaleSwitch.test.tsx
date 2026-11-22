import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

vi.mock("@/i18n/set-locale", () => ({ setLocale: async () => {} }));

const { LocaleSwitch } = await import("./LocaleSwitch");

function render(locale: "en" | "hi"): string {
  return renderToStaticMarkup(<LocaleSwitch locale={locale} t={createTranslator(catalogues[locale])} />);
}

/** The attributes and text of each `<tag>` in static markup (no DOM in this test environment). */
function elements(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([^<]*)`, "g"))].map(([, attributes = "", text]) => ({
    ...Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value])),
    text,
  }));
}

describe("LocaleSwitch", () => {
  it.each([
    ["en", "Language"],
    ["hi", "भाषा"],
  ] as const)("in %s, is a form group named in the current language", (locale, label) => {
    const [group] = elements(render(locale), "form");
    expect(group).toMatchObject({ role: "group", "aria-label": label });
  });

  it.each(["en", "hi"] as const)("in %s, offers each language named in its own language", (locale) => {
    const buttons = elements(render(locale), "button");
    expect(buttons).toEqual([
      expect.objectContaining({
        text: "English",
        lang: "en",
        name: "locale",
        value: "en",
        type: "submit",
        "aria-pressed": String(locale === "en"),
      }),
      expect.objectContaining({
        text: "हिन्दी",
        lang: "hi",
        name: "locale",
        value: "hi",
        type: "submit",
        "aria-pressed": String(locale === "hi"),
      }),
    ]);
  });
});
