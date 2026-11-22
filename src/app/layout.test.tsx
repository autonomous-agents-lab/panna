import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

vi.mock("./fonts", () => ({ fontVariables: "fonts" }));
vi.mock("@/i18n/set-locale", () => ({ setLocale: async () => {} }));
vi.mock("@/i18n/server", () => ({
  getLocale: async () => "hi",
  getMessages: async () => catalogues.hi,
  getTranslator: async () => ({ locale: "hi", t: createTranslator(catalogues.hi) }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

type Props = { children?: ReactNode; [key: string]: unknown };

/** The child elements of `element`, without rendering them. */
function childrenOf(element: ReactElement<Props>): ReactElement<Props>[] {
  return ([] as ReactNode[]).concat(element.props.children).filter(isValidElement) as ReactElement<Props>[];
}

describe("RootLayout", () => {
  it("renders the skip link first, then the header, the one main landmark and the footer", async () => {
    const { default: RootLayout } = await import("./layout");
    const { MAIN_ID, SkipLink } = await import("@/components/shell/SkipLink");
    const { SiteHeader } = await import("@/components/shell/SiteHeader");
    const { SiteFooter } = await import("@/components/shell/SiteFooter");
    const page = <p>page</p>;

    const html = await RootLayout({ children: page });
    const [, body] = childrenOf(html);
    const [provider] = childrenOf(body!);
    const shell = childrenOf(provider!);

    expect(html.props.lang).toBe("hi");
    expect(shell.map((element) => element.type)).toEqual([SkipLink, SiteHeader, "main", SiteFooter]);
    expect(shell[2]!.props).toEqual({ id: MAIN_ID, tabIndex: -1, children: page });
  });
});

describe("generateMetadata", () => {
  it("with NEXT_PUBLIC_APP_NAME=Kitaab and NEXT_PUBLIC_SITE_URL=https://example.org, needs no code changes", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Kitaab");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.org");
    vi.resetModules();
    const { generateMetadata } = await import("./layout");

    const metadata = await generateMetadata();

    expect(metadata.title).toEqual({ default: "Kitaab", template: "%s · Kitaab" });
    expect(metadata.openGraph).toMatchObject({ siteName: "Kitaab", title: "Kitaab", locale: "hi_IN" });
    expect(metadata.twitter).toMatchObject({ title: "Kitaab" });
    expect(String(metadata.metadataBase)).toBe("https://example.org/");
    expect(metadata.description).toBe(catalogues.hi["shell.description"]);
  });
});
