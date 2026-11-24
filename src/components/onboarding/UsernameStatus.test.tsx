import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";
import type { UsernameCheckState } from "@/lib/onboarding/username-checker";

import { UsernameStatus } from "./UsernameStatus";

function render(state: UsernameCheckState, locale: "en" | "hi" = "en"): string {
  return renderToStaticMarkup(
    <I18nProvider locale={locale} messages={catalogues[locale]}>
      <UsernameStatus id="status" state={state} />
    </I18nProvider>,
  );
}

const text = (html: string) => /<p [^>]*>(.*)<\/p>/.exec(html)?.[1];

describe("UsernameStatus (AC-2)", () => {
  it("is a polite live region that is present even when empty", () => {
    const html = render({ status: "idle" });
    expect(html).toMatch(/^<p id="status" role="status" aria-live="polite"[^>]*><\/p>$/);
  });

  it.each(["en", "hi"] as const)("in %s, says it is checking and when a name is available", (locale) => {
    const t = catalogues[locale];
    expect(text(render({ status: "checking" }, locale))).toBe(t["onboarding.username.checking"]);
    expect(text(render({ status: "available", username: "asha" }, locale))).toBe(
      t["onboarding.username.available"].replace("{username}", "asha"),
    );
  });

  it.each(["en", "hi"] as const)("in %s, gives the reason a name is unavailable", (locale) => {
    const t = catalogues[locale];
    for (const code of ["taken", "held", "reserved", "invalid_characters", "must_start_with_letter"] as const) {
      expect(text(render({ status: "unavailable", code }, locale))).toBe(t[`username.error.${code}`]);
    }
    expect(text(render({ status: "unavailable", code: "too_short" }, locale))).toBe(
      t["username.error.too_short"].replace("{min}", "3"),
    );
    expect(text(render({ status: "unavailable", code: "too_long" }, locale))).toBe(
      t["username.error.too_long"].replace("{max}", "30"),
    );
  });
});
