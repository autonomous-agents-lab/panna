import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";

import ErrorPage from "./error";

function render(locale: "en" | "hi"): string {
  const error = Object.assign(new Error("internal secret detail"), { digest: "digest-1234" });
  return renderToStaticMarkup(
    <I18nProvider locale={locale} messages={catalogues[locale]}>
      <ErrorPage error={error} reset={() => {}} />
    </I18nProvider>,
  );
}

describe("ErrorPage", () => {
  it.each(["en", "hi"] as const)("in %s, offers a translated retry button and home link", (locale) => {
    const t = catalogues[locale];
    const html = render(locale);
    expect(html).toContain(`<div role="alert"><h1>${t["error.title"]}</h1><p>${t["error.body"]}</p></div>`);
    expect(html).toContain(`<button type="button">${t["error.retry"]}</button>`);
    expect(html).toContain(`<a href="/">${t["error.home"]}</a>`);
  });

  it.each(["en", "hi"] as const)("in %s, shows no message, stack or digest", (locale) => {
    const html = render(locale);
    expect(html).not.toContain("internal secret detail");
    expect(html).not.toContain("digest-1234");
    expect(html).not.toMatch(/\bat\s.+:\d+:\d+/);
  });
});
