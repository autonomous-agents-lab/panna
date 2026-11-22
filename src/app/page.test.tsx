import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));

vi.mock("./fonts", () => ({ fontVariables: "fonts" }));
vi.mock("@/i18n/server", () => ({
  getLocale: async () => locale.current,
  getMessages: async () => catalogues[locale.current],
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { default: HomePage, generateMetadata } = await import("./page");

describe("HomePage", () => {
  it.each(["en", "hi"] as const)(
    "in %s, is a Coming soon page with the app name and the translated one-line description, with no main of its own",
    async (current) => {
      locale.current = current;
      const html = renderToStaticMarkup(await HomePage());
      const t = catalogues[current];
      expect(html).toMatch(
        new RegExp(
          `^<div class="[^"]*"><h1 class="[^"]*">${config.appName}</h1>` +
            `<p class="[^"]*">${t["home.comingSoon"]}</p><p class="[^"]*">${t["home.tagline"]}</p></div>$`,
        ),
      );
    },
  );

  it("needs no database, login or secret: it reads no env, Supabase or server-only config itself", () => {
    const source = readFileSync(join(import.meta.dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/process\.env|@\/lib\/supabase|getSupabaseConfig|@\/config\/server|next\/headers/);
    expect(source).toMatch(/^import \{ config \} from "@\/config";$/m);
  });

  it("is canonical at the site root", async () => {
    const metadata = await generateMetadata();
    expect(metadata.alternates).toEqual({ canonical: "/" });
    expect(metadata.openGraph).toMatchObject({ url: "/", siteName: config.appName });
    expect(metadata).not.toHaveProperty("robots");
  });
});

describe("without any Supabase variables set", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("still renders the shell and the home page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    vi.resetModules();
    locale.current = "en";

    const { default: RootLayout } = await import("./layout");
    const { default: FreshHomePage } = await import("./page");
    const { config: freshConfig } = await import("@/config");

    const page = await FreshHomePage();
    const shell = await RootLayout({ children: page });

    expect(shell.props.lang).toBe("en");
    expect(renderToStaticMarkup(page)).toMatch(new RegExp(`<h1 class="[^"]*">${freshConfig.appName}</h1>`));
  });
});
