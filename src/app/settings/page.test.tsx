import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));
const requireUser = vi.hoisted(() => vi.fn(async () => ({ id: "u1", email: "writer@example.org" } as { id: string; email?: string })));

vi.mock("@/app/auth/actions", () => ({ signOut: async () => {} }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const settings = await import("./page");

describe.each([
  { name: "settings", path: "/settings", titleKey: "settings.title", module: settings, signOut: true },
] as const)("the $name placeholder (AC-4, AC-6)", ({ path, titleKey, module, signOut }) => {
  it.each(["en", "hi"] as const)("in %s, shows its heading and who is signed in", async (current) => {
    locale.current = current;
    const t = catalogues[current];
    const html = renderToStaticMarkup(await module.default());
    expect(requireUser).toHaveBeenLastCalledWith(path);
    expect(html).toContain(`<h1>${t[titleKey]}</h1>`);
    expect(html).toContain(`<p>${t["auth.signedInAs"].replace("{email}", "writer@example.org")}</p>`);
    expect(html.includes(`>${t["auth.nav.signOut"]}</button>`)).toBe(signOut);
  });

  it("copes with a user that has no email", async () => {
    locale.current = "en";
    requireUser.mockResolvedValueOnce({ id: "u2" });
    expect(renderToStaticMarkup(await module.default())).toContain("<p>Signed in as </p>");
  });

  it("is noindex at its own canonical path", async () => {
    const metadata = await module.generateMetadata();
    expect(metadata.alternates).toEqual({ canonical: path });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
