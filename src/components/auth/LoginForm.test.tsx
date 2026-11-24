import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MagicLinkResult } from "@/contracts/auth";
import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";

vi.mock("@/app/login/actions", () => ({ requestMagicLink: async () => ({ status: "idle" }), signInWithGoogle: async () => {} }));

const { LoginForm, LoginFormFields } = await import("./LoginForm");

type Locale = "en" | "hi";

function render(node: ReactNode, locale: Locale = "en"): string {
  return renderToStaticMarkup(
    <I18nProvider locale={locale} messages={catalogues[locale]}>
      {node}
    </I18nProvider>,
  );
}

function fields(result: MagicLinkResult, options: { locale?: Locale; pending?: boolean; loginError?: "link_invalid" | "oauth_failed" } = {}) {
  return render(
    <LoginFormFields
      next="/settings"
      result={result}
      pending={options.pending ?? false}
      loginError={options.loginError}
      magicLinkAction={() => {}}
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

const email = (html: string) => attributesOf(html, "input", /name="email"/);

describe("LoginForm", () => {
  it("starts idle with both forms carrying the safe next", () => {
    const html = render(<LoginForm next="/onboarding" />);
    expect(html.match(/<input type="hidden" name="next" value="\/onboarding"\/>/g)).toHaveLength(2);
    expect(html).toContain(">Email me a sign-in link</button>");
    expect(html).toContain(">Continue with Google</button>");
  });
});

describe("LoginFormFields (AC-1, AC-9)", () => {
  it.each(["en", "hi"] as const)("in %s, labels the email field and both buttons", (locale) => {
    const t = catalogues[locale];
    const html = fields({ status: "idle" }, { locale });
    const input = email(html);
    expect(html).toContain(`<label for="${input.id}"`);
    expect(html).toContain(`>${t["auth.login.emailLabel"]}</label>`);
    expect(input).toMatchObject({ type: "email", autoComplete: "email", "aria-invalid": "false" });
    expect(input).not.toHaveProperty("aria-describedby");
    expect(html).toContain(`>${t["auth.login.submit"]}</button>`);
    expect(html).toContain(`>${t["auth.login.google"]}</button>`);
  });

  it("validates on the server, so the error is in the page's language, not the browser's", () => {
    expect(attributesOf(fields({ status: "idle" }), "form", /novalidate/i)).toBeDefined();
  });

  it("keeps an always-present status region and alert region, so updates are announced", () => {
    const html = fields({ status: "idle" });
    expect(html).toContain('<div role="alert"></div><div role="status"></div>');
  });

  it.each(["en", "hi"] as const)("in %s, says check your email once the link is sent", (locale) => {
    const html = fields({ status: "sent", email: "writer@example.org" }, { locale });
    const message = catalogues[locale]["auth.login.sent"].replace("{email}", "writer@example.org");
    expect(html).toMatch(new RegExp(`<div role="status"><p [^>]*>${message.replace(/[.?]/g, "\\$&")}</p></div>`));
    expect(html).toContain('<div role="alert"></div>');
  });

  it.each(["en", "hi"] as const)("in %s, shows an inline error tied to the email field when it is invalid", (locale) => {
    const html = fields({ status: "invalid", email: "nope" }, { locale });
    const input = email(html);
    const error = attributesOf(html, "p", /role="alert"/);
    expect(input).toMatchObject({ "aria-invalid": "true", "aria-describedby": error.id, value: "nope" });
    expect(html).toContain(`>${catalogues[locale]["auth.error.emailInvalid"]}</p>`);
  });

  it("reports a failed send in the alert region and keeps the email", () => {
    const html = fields({ status: "failed", email: "writer@example.org" });
    const error = attributesOf(html, "p", /id=/);
    expect(html).toContain(`<div role="alert"><p id="${error.id}"`);
    expect(html).toContain(`>${catalogues.en["auth.error.sendFailed"]}</p>`);
    expect(email(html)).toMatchObject({ "aria-invalid": "false", "aria-describedby": error.id, value: "writer@example.org" });
  });

  it("disables submit and says it is sending while pending", () => {
    const html = fields({ status: "idle" }, { pending: true });
    expect(html).toMatch(/<button type="submit" disabled=""[^>]*>Sending…<\/button>/);
  });
});

describe("LoginFormFields after a failed link (AC-8)", () => {
  it.each(["en", "hi"] as const)("in %s, explains the link failed and focuses the email to get a new one", (locale) => {
    const html = fields({ status: "idle" }, { locale, loginError: "link_invalid" });
    expect(html).toContain(`>${catalogues[locale]["auth.error.linkInvalid"]}</p></div>`);
    const input = email(html);
    expect(input).toHaveProperty("autofocus");
    expect(input["aria-describedby"]).toBe(attributesOf(html, "p", /id=/).id);
  });

  it("explains a failed Google sign-in", () => {
    expect(fields({ status: "idle" }, { loginError: "oauth_failed" })).toContain(`>${catalogues.en["auth.error.oauthFailed"]}</p>`);
  });

  it("drops the old link error once a new link is sent", () => {
    const html = fields({ status: "sent", email: "writer@example.org" }, { loginError: "link_invalid" });
    expect(html).not.toContain(catalogues.en["auth.error.linkInvalid"]);
    expect(email(html)).not.toHaveProperty("autofocus");
  });
});
