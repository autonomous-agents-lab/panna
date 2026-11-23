import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { richTextPlainText, type BookSource, type ReaderPageView } from "@/contracts";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";
import { HIDDEN_MARKERS, SAMPLE_IDS, SAMPLE_USERNAMES, sampleBookStore } from "@/lib/reader/fixtures";
import { createMemoryBookSource } from "@/lib/reader/memory-source";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));
const fakeSource = vi.hoisted(() => ({
  getPublishedBook: vi.fn<BookSource["getPublishedBook"]>(),
  getPublishedPage: vi.fn<BookSource["getPublishedPage"]>(),
}));

// The routes reach data only through getBookSource(); replacing it here is all a swap takes.
vi.mock("@/lib/reader/source", () => ({ getBookSource: () => fakeSource }));
vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const samples = createMemoryBookSource(sampleBookStore);

beforeEach(() => {
  locale.current = "en";
  fakeSource.getPublishedBook.mockReset().mockImplementation(samples.getPublishedBook);
  fakeSource.getPublishedPage.mockReset().mockImplementation(samples.getPublishedPage);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const { default: PageRoute, generateMetadata } = await import("./page");
const { notFoundMetadata } = await import("@/lib/page-metadata");

const props = (username: string, pageId: string) => ({ params: Promise.resolve({ username, pageId }) });
const render = async (username: string, pageId: string) =>
  renderToStaticMarkup(await PageRoute(props(username, pageId)));
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

const { bilingual, drafts } = SAMPLE_IDS;

const handBuilt: ReaderPageView = {
  writer: { username: "fake_writer", display_name: "Fake Writer", bio: null, photo_url: null },
  book: {
    id: "0f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
    title: "A Fake Book",
    subtitle: null,
    cover_style: "classic",
    font: "kalam",
    default_language: "en",
  },
  chapter: { id: "1f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20", title: "Fake chapter" },
  page: {
    id: "2f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
    title: null,
    language: "en",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Fake page text." }] }] },
    published_at: "2026-11-10T09:00:00+00:00",
  },
};

describe("/<username>/<pageId> reads only through BookSource (AC-10)", () => {
  it("asks the source for that one page and nothing else", async () => {
    await render(SAMPLE_USERNAMES.bilingual, bilingual.pages.rainEnglish);
    expect(fakeSource.getPublishedPage).toHaveBeenCalledWith(SAMPLE_USERNAMES.bilingual, bilingual.pages.rainEnglish);
    expect(fakeSource.getPublishedBook).not.toHaveBeenCalled();
  });

  it("renders whatever a different implementation returns, with no route change", async () => {
    fakeSource.getPublishedPage.mockResolvedValue(handBuilt);
    const html = await render("fake_writer", handBuilt.page.id);
    expect(html).toContain("A Fake Book");
    expect(html).toContain("Fake chapter");
    expect(html).toContain("Fake page text.");
    expect(html).toContain('<a href="/fake_writer">A Fake Book</a>');
  });

  it("imports the data layer only through the cached loaders, never an implementation", () => {
    const source = readFileSync(join(import.meta.dirname, "page.tsx"), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports.filter((path) => path?.startsWith("@/lib/reader"))).toEqual(["@/lib/reader/load"]);
    expect(source).not.toMatch(/memory-source|fixtures|project|supabase/);
  });
});

describe("/<username>/<pageId> HTML (AC-5)", () => {
  it("has the page's full text, its chapter title and the cover, linking back to the book", async () => {
    const html = await render(SAMPLE_USERNAMES.bilingual, bilingual.pages.morningHindi);
    const view = (await samples.getPublishedPage(SAMPLE_USERNAMES.bilingual, bilingual.pages.morningHindi))!;
    expect(html).toMatch(/<h2 [^>]*>सुबह \/ Morning<\/h2>/);
    for (const paragraph of richTextPlainText(view.page.content).split("\n\n")) expect(html).toContain(paragraph);
    expect(html).toContain(`<a href="/${SAMPLE_USERNAMES.bilingual}">नमूने की डायरी</a>`);
    expect(html).toContain("by Sample Writer");
    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).toMatch(/<article lang="hi"/);
  });

  it("shows only that page, not the rest of the book", async () => {
    const html = await render(SAMPLE_USERNAMES.bilingual, bilingual.pages.morningHindi);
    expect(html).not.toContain("This is sample text");
    expect(html).not.toContain("बारिश / Rain");
  });
});

describe("/<username>/<pageId> not found (AC-4, AC-6)", () => {
  it.each([
    ["a draft", drafts.pages.draft],
    ["an unpublished page", drafts.pages.unpublished],
    ["an archived page", drafts.pages.archived],
    ["a page in an archived chapter", drafts.pages.inArchivedChapter],
    ["an unknown id", "5d000000-0000-4000-8000-00000000ffff"],
    ["another writer's page", bilingual.pages.rainEnglish],
  ])("is the 404 page for %s", async (_what, pageId) => {
    await expect(PageRoute(props(SAMPLE_USERNAMES.drafts, pageId))).rejects.toMatchObject(NOT_FOUND);
    // Thrown from generateMetadata, notFound() gives an empty error shell instead of the 404 page.
    await expect(generateMetadata(props(SAMPLE_USERNAMES.drafts, pageId))).resolves.toEqual(await notFoundMetadata());
    expect(fakeSource.getPublishedPage).toHaveBeenCalledWith(SAMPLE_USERNAMES.drafts, pageId);
  });

  it("never renders hidden text, even for its own book's pages", async () => {
    const html = await render(SAMPLE_USERNAMES.drafts, drafts.pages.published);
    for (const marker of Object.values(HIDDEN_MARKERS)) expect(html).not.toContain(marker);
  });

  it.each([
    ["a malformed page id", SAMPLE_USERNAMES.bilingual, "not-a-uuid"],
    ["a page id with an extra character", SAMPLE_USERNAMES.bilingual, `${bilingual.pages.rainEnglish}x`],
    ["a malformed username", "Sample_Writer_Bilingual", bilingual.pages.rainEnglish],
  ])("is the 404 page for %s, without asking the source", async (_what, username, pageId) => {
    await expect(PageRoute(props(username, pageId))).rejects.toMatchObject(NOT_FOUND);
    await expect(generateMetadata(props(username, pageId))).resolves.toEqual(await notFoundMetadata());
    expect(fakeSource.getPublishedPage).not.toHaveBeenCalled();
  });
});

describe("/<username>/<pageId> metadata (AC-9)", () => {
  it.each(["en", "hi"] as const)("in %s, titles the document with the chapter, book, writer and app name", async (current) => {
    locale.current = current;
    const { config } = await import("@/config");
    const metadata = await generateMetadata(props(SAMPLE_USERNAMES.bilingual, bilingual.pages.rainEnglish));
    const title = createTranslator(catalogues[current])("reader.pageDocumentTitle", {
      chapterTitle: "बारिश / Rain",
      bookTitle: "नमूने की डायरी",
      writerName: "Sample Writer",
    });
    expect(metadata.title).toEqual({ absolute: `${title} · ${config.appName}` });
    expect(metadata.alternates).toEqual({
      canonical: `/${SAMPLE_USERNAMES.bilingual}/${bilingual.pages.rainEnglish}`,
    });
  });

  it("takes the app name from NEXT_PUBLIC_APP_NAME", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Kitaab Test");
    vi.resetModules();
    const fresh = await import("./page");
    const metadata = await fresh.generateMetadata(props(SAMPLE_USERNAMES.bilingual, bilingual.pages.rainEnglish));
    expect(metadata.title).toEqual({ absolute: "बारिश / Rain: नमूने की डायरी by Sample Writer · Kitaab Test" });
  });
});
