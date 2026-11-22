import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogues } from "./catalogue";
import { I18nProvider, useLocale, useTranslator } from "./client";

function Probe() {
  const t = useTranslator();
  return <span lang={useLocale()}>{t("shell.homeLink", { appName: "Book" })}</span>;
}

describe("I18nProvider", () => {
  it.each([
    ["en", "Book, home"],
    ["hi", "Book, मुखपृष्ठ"],
  ] as const)("gives Client Components the %s locale and translator", (locale, text) => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={locale} messages={catalogues[locale]}>
        <Probe />
      </I18nProvider>,
    );
    expect(html).toBe(`<span lang="${locale}">${text}</span>`);
  });

  it("is required by the hooks", () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/inside I18nProvider/);
  });
});
