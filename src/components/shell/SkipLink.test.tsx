import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));

vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { MAIN_ID, SkipLink } = await import("./SkipLink");

describe("SkipLink", () => {
  it.each([
    ["en", "Skip to content"],
    ["hi", "मुख्य सामग्री पर जाएँ"],
  ] as const)("in %s, is a plain link to the main landmark in that language", async (current, label) => {
    locale.current = current;
    expect(renderToStaticMarkup(await SkipLink())).toBe(`<a href="#${MAIN_ID}" class="skip-link">${label}</a>`);
  });
});
