import { describe, expect, it } from "vitest";

import { buildMetadata, type MetadataInput } from "./metadata";

const base: MetadataInput = {
  appName: "Kitaab",
  siteUrl: "https://example.org",
  description: "A digital book.",
  locale: "en",
};

describe("buildMetadata", () => {
  it("uses the configured app name for the title, Open Graph, Twitter and application name", () => {
    const metadata = buildMetadata({ ...base, path: "/" });
    expect(metadata.applicationName).toBe("Kitaab");
    expect(metadata.title).toEqual({ default: "Kitaab", template: "%s · Kitaab" });
    expect(metadata.openGraph).toMatchObject({ siteName: "Kitaab", title: "Kitaab" });
    expect(metadata.twitter).toEqual({ card: "summary", title: "Kitaab", description: "A digital book." });
  });

  it("resolves the canonical link and og:url against the configured site URL", () => {
    const metadata = buildMetadata({ ...base, path: "/" });
    expect(String(metadata.metadataBase)).toBe("https://example.org/");
    expect(metadata.alternates).toEqual({ canonical: "/" });
    expect(metadata.openGraph).toMatchObject({ url: "/" });
    expect(new URL(String(metadata.alternates?.canonical), metadata.metadataBase!).href).toBe("https://example.org/");
  });

  it("leaves out the canonical link and og:url when no path is given", () => {
    const metadata = buildMetadata(base);
    expect(metadata).not.toHaveProperty("alternates");
    expect(metadata.openGraph).not.toHaveProperty("url");
  });

  it("puts a page title before the app name everywhere a title appears", () => {
    const metadata = buildMetadata({ ...base, title: "Page not found" });
    expect(metadata.title).toEqual({ absolute: "Page not found · Kitaab" });
    expect(metadata.openGraph).toMatchObject({ title: "Page not found · Kitaab", siteName: "Kitaab" });
    expect(metadata.twitter).toMatchObject({ title: "Page not found · Kitaab" });
  });

  it("carries the description, website type and manifest link", () => {
    const metadata = buildMetadata(base);
    expect(metadata.description).toBe("A digital book.");
    expect(metadata.openGraph).toMatchObject({ description: "A digital book.", type: "website" });
    expect(metadata.manifest).toBe("/manifest.webmanifest");
  });

  it.each([
    ["en", "en_IN"],
    ["hi", "hi_IN"],
  ] as const)("sets og:locale for %s to %s", (locale, expected) => {
    expect(buildMetadata({ ...base, locale }).openGraph).toMatchObject({ locale: expected });
  });

  it("is indexable by default and noindex (still followed) on request", () => {
    expect(buildMetadata(base)).not.toHaveProperty("robots");
    expect(buildMetadata({ ...base, noindex: false })).not.toHaveProperty("robots");
    expect(buildMetadata({ ...base, noindex: true }).robots).toEqual({ index: false, follow: true });
  });
});
