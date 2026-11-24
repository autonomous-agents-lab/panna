import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import type { OnboardingResult } from "@/contracts/onboarding";
import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";
import type { UsernameCheckState } from "@/lib/onboarding/username-checker";

vi.mock("@/app/onboarding/actions", () => ({
  createProfile: async () => ({ status: "idle" }),
  checkUsername: async () => ({ status: "unknown" }),
}));

const { OnboardingForm, OnboardingFormFields } = await import("./OnboardingForm");

type Locale = "en" | "hi";

function render(node: ReactNode, locale: Locale = "en"): string {
  return renderToStaticMarkup(
    <I18nProvider locale={locale} messages={catalogues[locale]}>
      {node}
    </I18nProvider>,
  );
}

function fields(
  result: OnboardingResult,
  options: { locale?: Locale; pending?: boolean; availability?: UsernameCheckState } = {},
) {
  return render(
    <OnboardingFormFields
      defaultLanguage="en"
      result={result}
      pending={options.pending ?? false}
      action={() => {}}
      availability={options.availability ?? { status: "idle" }}
      onUsernameChange={() => {}}
    />,
    options.locale,
  );
}

/** The attributes of the first `<tag ...>` matching `filter` in static markup. */
function attributesOf(html: string, tag: string, filter: RegExp = /./): Record<string, string> {
  const found = [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))].find(([, attributes]) => filter.test(attributes ?? ""));
  if (!found) throw new Error(`no <${tag}> matching ${filter}`);
  return Object.fromEntries([...(found[1] ?? "").matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
}

const input = (html: string, name: string) => attributesOf(html, "input", new RegExp(`name="${name}"`));
const VALUES = { username: "Asha", display_name: "Asha Rao", preferred_language: "hi" };

describe("OnboardingForm", () => {
  it("starts idle, preselecting the given language", () => {
    const html = render(<OnboardingForm defaultLanguage="hi" />);
    expect(attributesOf(html, "input", /value="hi"/)).toHaveProperty("checked");
    expect(attributesOf(html, "input", /value="en"/)).not.toHaveProperty("checked");
  });
});

describe("OnboardingFormFields labels (AC-8)", () => {
  it.each(["en", "hi"] as const)("in %s, labels every field and the language group", (locale) => {
    const t = catalogues[locale];
    const html = fields({ status: "idle" }, { locale });
    const username = input(html, "username");
    const displayName = input(html, "display_name");
    expect(html).toMatch(new RegExp(`<label for="${username.id}"[^>]*>${t["onboarding.username.label"]}</label>`));
    expect(html).toMatch(new RegExp(`<label for="${displayName.id}"[^>]*>${t["onboarding.displayName.label"]}</label>`));
    expect(html).toMatch(new RegExp(`<legend[^>]*>${t["onboarding.language.legend"]}</legend>`));
    expect(html).toMatch(/<label[^>]*><input type="radio"[^>]*value="hi"\/><span lang="hi">हिन्दी<\/span><\/label>/);
    expect(html).toMatch(/<label[^>]*><input type="radio"[^>]*value="en"\/><span lang="en">English<\/span><\/label>/);
    expect(html).toContain(t["onboarding.language.hint"].replace("{appName}", config.appName));
    expect(html).toContain(`>${t["onboarding.submit"]}</button>`);
  });

  it("validates on the server, and ties the username to its hint and live status", () => {
    const html = fields({ status: "idle" });
    expect(attributesOf(html, "form", /novalidate/i)).toBeDefined();
    const username = input(html, "username");
    const status = attributesOf(html, "p", /role="status"/);
    expect(status).toMatchObject({ "aria-live": "polite" });
    expect(username["aria-describedby"]).toBe(`${username.id}-hint ${status.id}`);
    expect(username).toMatchObject({ "aria-invalid": "false", autoComplete: "username", value: "" });
    expect(html).toContain('<div role="alert"></div>');
  });

  it("shows the live availability status", () => {
    const html = fields({ status: "idle" }, { availability: { status: "available", username: "asha" } });
    expect(html).toContain(">asha is available.</p>");
  });
});

describe("OnboardingFormFields errors (AC-4, AC-8)", () => {
  it.each(["en", "hi"] as const)("in %s, shows a taken username inline and keeps what was typed", (locale) => {
    const html = fields({ status: "invalid", errors: { username: "taken" }, values: VALUES }, { locale });
    const username = input(html, "username");
    const error = attributesOf(html, "p", /role="alert"/);
    expect(username).toMatchObject({ "aria-invalid": "true", value: "Asha" });
    expect(username["aria-describedby"]?.split(" ")).toContain(error.id);
    expect(html).toContain(`>${catalogues[locale]["username.error.taken"]}</p>`);
    expect(input(html, "display_name")).toMatchObject({ "aria-invalid": "false", value: "Asha Rao" });
    expect(attributesOf(html, "input", /value="hi"/)).toHaveProperty("checked");
  });

  it.each(["en", "hi"] as const)("in %s, shows every field's error inline, each tied to its field", (locale) => {
    const t = catalogues[locale];
    const html = fields(
      {
        status: "invalid",
        errors: { username: "too_short", display_name: "too_long", preferred_language: "unsupported" },
        values: { username: "a", display_name: "x".repeat(51), preferred_language: "fr" },
      },
      { locale },
    );
    expect(html).toContain(`>${t["username.error.too_short"].replace("{min}", "3")}</p>`);
    expect(html).toContain(`>${t["onboarding.displayName.error.too_long"].replace("{max}", "50")}</p>`);
    expect(html).toContain(`>${t["onboarding.language.error.unsupported"]}</p>`);

    const displayName = input(html, "display_name");
    expect(displayName["aria-invalid"]).toBe("true");
    expect(displayName["aria-describedby"]).toBe(`${displayName.id}-hint ${displayName.id}-error`);
    expect(html).toContain(`id="${displayName.id}-error" role="alert"`);
    const fieldset = attributesOf(html, "fieldset");
    const languageError = attributesOf(html, "p", /-language-error"/);
    expect(fieldset["aria-describedby"]?.split(" ")).toEqual([expect.stringMatching(/-language-hint$/), languageError.id]);
    expect(languageError).toMatchObject({ role: "alert" });
    // An unsupported language isn't echoed back as a choice; the default is selected instead.
    expect(attributesOf(html, "input", /value="en"/)).toHaveProperty("checked");
  });

  it("asks for a display name when it is missing", () => {
    const html = fields({ status: "invalid", errors: { display_name: "required" }, values: VALUES });
    expect(html).toContain(`>${catalogues.en["onboarding.displayName.error.required"]}</p>`);
    expect(input(html, "username")["aria-invalid"]).toBe("false");
  });

  it.each(["en", "hi"] as const)("in %s, reports a failure in the alert region and keeps the values", (locale) => {
    const html = fields({ status: "failed", values: VALUES }, { locale });
    expect(html).toMatch(new RegExp(`<div role="alert"><p id="[^"]+-form-error"[^>]*>${catalogues[locale]["onboarding.failed"]}</p></div>`));
    expect(input(html, "username").value).toBe("Asha");
  });

  it("disables submit and says it is creating the book while pending", () => {
    expect(fields({ status: "idle" }, { pending: true })).toMatch(/<button type="submit" disabled=""[^>]*>Creating your book…<\/button>/);
  });
});
