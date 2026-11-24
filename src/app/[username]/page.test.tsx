import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import type { PublicBook } from "@/contracts/public-book";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

class NavigationSignal extends Error {
  constructor(
    readonly kind: "notFound" | "permanentRedirect",
    readonly location?: string,
  ) {
    super(kind);
  }
}

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));
const getPublicBook = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NavigationSignal("notFound");
  },
  permanentRedirect: (location: string) => {
    throw new NavigationSignal("permanentRedirect", location);
  },
}));
vi.mock("@/lib/books/public-book", () => ({ getPublicBook }));
vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { default: BookPage, generateMetadata } = await import("./page");

const BOOK: PublicBook = {
  username: "asha",
  display_name: "आशा राव",
  bio: null,
  avatar_path: null,
  book: { title: "आशा की कॉपी", subtitle: "कविताएँ", default_language: "hi" },
};

const props = (username: string) => ({ params: Promise.resolve({ username }) });

async function render(username = "asha"): Promise<string> {
  return renderToStaticMarkup(await BookPage(props(username)));
}

beforeEach(() => {
  vi.clearAllMocks();
  locale.current = "en";
  getPublicBook.mockResolvedValue(BOOK);
});

describe("the book placeholder at /<username> (AC-6)", () => {
  it.each(["en", "hi"] as const)("in %s, shows the title, subtitle, writer, initials and note", async (current) => {
    locale.current = current;
    const t = catalogues[current];
    const html = await render();
    expect(getPublicBook).toHaveBeenCalledWith("asha");
    expect(html).toMatch(/<article lang="hi"[^>]*>/);
    expect(html).toMatch(/<h1[^>]*>आशा की कॉपी<\/h1>/);
    expect(html).toMatch(/<p[^>]*>कविताएँ<\/p>/);
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>आरा<\/span>/);
    expect(html).toMatch(new RegExp(`<p lang="${current}"[^>]*>${t["book.byline"].replace("{name}", "आशा राव")}</p>`));
    expect(html).toMatch(new RegExp(`<p lang="${current}"[^>]*>${t["book.placeholder"]}</p>`));
  });

  it("shows the bio when there is one, and leaves out what is empty", async () => {
    getPublicBook.mockResolvedValue({ ...BOOK, bio: "Poems & notes", book: { ...BOOK.book, subtitle: null } });
    const html = await render();
    expect(html).toMatch(/<p[^>]*>Poems &amp; notes<\/p>/);
    expect(html).not.toContain("कविताएँ");
  });

  it("embeds Book structured data with the canonical URL", async () => {
    const html = await render();
    const json = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1];
    expect(JSON.parse(json ?? "null")).toMatchObject({
      "@type": "Book",
      name: "आशा की कॉपी",
      inLanguage: "hi",
      url: new URL("/asha", config.siteUrl).href,
      author: { name: "आशा राव" },
    });
  });

  it.each(["Asha", "ASHA", "asHa_1"])("redirects %s permanently to the lowercase URL before looking it up", async (param) => {
    await expect(BookPage(props(param))).rejects.toMatchObject({
      kind: "permanentRedirect",
      location: `/${param.toLowerCase()}`,
    });
    expect(getPublicBook).not.toHaveBeenCalled();
  });

  it.each(["en", "hi"] as const)("in %s, has a localised title and description, canonical and og:locale", async (current) => {
    locale.current = current;
    const t = catalogues[current];
    const metadata = await generateMetadata(props("asha"));
    const title = `${t["book.metaTitle"].replace("{title}", "आशा की कॉपी").replace("{name}", "आशा राव")} · ${config.appName}`;
    const description = t["book.metaDescription"].replace("{name}", "आशा राव").replace("{appName}", config.appName);
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toBe(description);
    expect(metadata.alternates).toEqual({ canonical: "/asha" });
    expect(metadata.openGraph).toMatchObject({ title, description, url: "/asha", locale: "hi_IN" });
    expect(metadata.robots).toBeUndefined();
  });

  it("uses the bio as the description when there is one, and og:locale from the book's language", async () => {
    getPublicBook.mockResolvedValue({ ...BOOK, bio: "Poems", book: { ...BOOK.book, default_language: "en" } });
    const metadata = await generateMetadata(props("asha"));
    expect(metadata.description).toBe("Poems");
    expect(metadata.openGraph).toMatchObject({ locale: "en_IN" });
  });
});

describe("an unknown /<username> (AC-7)", () => {
  it("is a 404 when no one has the name", async () => {
    getPublicBook.mockResolvedValue(null);
    await expect(BookPage(props("nobody"))).rejects.toMatchObject({ kind: "notFound" });
    await expect(generateMetadata(props("nobody"))).rejects.toMatchObject({ kind: "notFound" });
  });

  it.each(["ab", "1asha", "asha-k", "robots.txt", "%E0%A4%86", "Ksha", "a".repeat(31)])(
    "is a 404 for %j without querying the database",
    async (param) => {
      await expect(BookPage(props(param))).rejects.toMatchObject({ kind: "notFound" });
      expect(getPublicBook).not.toHaveBeenCalled();
    },
  );
});
