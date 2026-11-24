import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));
const getCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/set-locale", () => ({ setLocale: async () => {} }));
vi.mock("@/app/auth/actions", () => ({ signOut: async () => {} }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { SiteHeader } = await import("./SiteHeader");

beforeEach(() => getCurrentUser.mockResolvedValue(null));

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

  it.each(["en", "hi"] as const)("in %s, offers Sign in to a signed-out visitor (AC-6)", async (current) => {
    locale.current = current;
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toMatch(new RegExp(`<a [^>]*href="/login"[^>]*>${catalogues[current]["auth.nav.signIn"]}</a>`));
    expect(html).not.toContain(catalogues[current]["auth.nav.signOut"]);
  });

  it("offers Sign out, and no Sign in link, to a signed-in user (AC-6)", async () => {
    locale.current = "en";
    getCurrentUser.mockResolvedValue({ id: "u1" });
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toMatch(/<form[^>]*><button type="submit"[^>]*>Sign out<\/button><\/form>/);
    expect(html).not.toContain(`href="/login"`);
  });
});
