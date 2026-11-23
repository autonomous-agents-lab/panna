import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookSource, ReaderBook, RichTextBlock } from "@/contracts";
import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";
import { HIDDEN_MARKERS, SAMPLE_USERNAMES, sampleBookStore } from "@/lib/reader/fixtures";
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

const { default: BookRoute, generateMetadata } = await import("./page");
const { notFoundMetadata } = await import("@/lib/page-metadata");

const props = (username: string) => ({ params: Promise.resolve({ username }) });
const render = async (username: string) => renderToStaticMarkup(await BookRoute(props(username)));
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

function textRuns(blocks: readonly RichTextBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "blockquote"
      ? textRuns(block.content)
      : (block.content ?? []).flatMap((node) => (node.type === "text" && node.text.trim().length >= 5 ? [node.text] : [])),
  );
}

const handBuilt: ReaderBook = {
  writer: { username: "fake_writer", display_name: "Fake Writer", bio: "Only in this test.", photo_url: null },
  book: {
    id: "0f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
    title: "A Fake Book",
    subtitle: null,
    cover_style: "kraft",
    font: "laila",
    default_language: "en",
  },
  chapters: [
    {
      id: "1f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
      title: "Fake chapter",
      pages: [
        {
          id: "2f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
          title: null,
          language: "en",
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Fake page text." }] }] },
          published_at: "2026-11-10T09:00:00+00:00",
        },
      ],
    },
  ],
};

describe("/<username> reads only through BookSource (AC-10)", () => {
  it("asks the source for the writer's published book and nothing else", async () => {
    await render(SAMPLE_USERNAMES.bilingual);
    expect(fakeSource.getPublishedBook).toHaveBeenCalledWith(SAMPLE_USERNAMES.bilingual);
    expect(fakeSource.getPublishedPage).not.toHaveBeenCalled();
  });

  it("renders whatever a different implementation returns, with no route change", async () => {
    fakeSource.getPublishedBook.mockResolvedValue(handBuilt);
    const html = await render("fake_writer");
    expect(html).toContain("A Fake Book");
    expect(html).toContain("by Fake Writer");
    expect(html).toContain('data-cover-style="kraft" data-font="laila"');
    expect(html).toContain("Fake page text.");
  });

  it("imports the data layer only through the cached loaders, never an implementation", () => {
    const source = readFileSync(join(import.meta.dirname, "page.tsx"), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports.filter((path) => path?.startsWith("@/lib/reader"))).toEqual(["@/lib/reader/load"]);
    expect(source).not.toMatch(/memory-source|fixtures|project|supabase/);
  });
});

describe("/<username> HTML", () => {
  it("has the title, writer, bio and every published page in chapter and page order (AC-2)", async () => {
    const html = await render(SAMPLE_USERNAMES.bilingual);
    const book = (await samples.getPublishedBook(SAMPLE_USERNAMES.bilingual))!;
    expect(html).toContain(book.book.title);
    expect(html).toContain(book.writer.display_name);
    expect(html).toContain(book.writer.bio);
    // Every chapter title and every run of page text (short runs like "." would match anywhere).
    const texts = book.chapters.flatMap((chapter) => [
      chapter.title,
      ...chapter.pages.flatMap((page) => textRuns(page.content.content)),
    ]);
    expect(texts.length).toBeGreaterThan(20);
    const positions = texts.map((text) => html.indexOf(text));
    expect(positions.filter((position) => position < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("marks each page's container with its own language (AC-3)", async () => {
    const html = await render(SAMPLE_USERNAMES.bilingual);
    const languages = [...html.matchAll(/<article lang="(\w+)"/g)].map((match) => match[1]);
    expect(languages).toEqual(["hi", "en", "en", "hi", "en"]);
    expect(html).toMatch(/<article lang="hi"[^>]*><h3[^>]*>नमूने की सुबह<\/h3><p>यह नमूने का पाठ है/);
    expect(html).toMatch(/<article lang="en"[^>]*><h3[^>]*>A sample morning<\/h3><p>This is sample text/);
  });

  it("shows no draft, unpublished or archived text (AC-4)", async () => {
    const html = await render(SAMPLE_USERNAMES.drafts);
    expect(html).toContain("Sample published text from a book that also has drafts.");
    for (const marker of Object.values(HIDDEN_MARKERS)) expect(html).not.toContain(marker);
    expect(html).not.toContain("Sample archived chapter");
  });

  it.each(["en", "hi"] as const)(
    "in %s, shows the cover and a localised empty state for a book with nothing published (AC-8)",
    async (current) => {
      locale.current = current;
      const html = await render(SAMPLE_USERNAMES.empty);
      expect(html).toContain("An Empty Sample Book");
      expect(html).toContain(catalogues[current]["reader.byline"].replace("{writerName}", "Sample Beginner"));
      expect(html).toMatch(new RegExp(`<p class="[^"]*">${catalogues[current]["reader.empty"]}</p>`));
      expect(html).not.toContain("<section");
      expect(html).not.toContain("<article");
    },
  );

  it("has no empty state when there are pages", async () => {
    expect(await render(SAMPLE_USERNAMES.bilingual)).not.toContain(catalogues.en["reader.empty"]);
  });
});

describe("/<username> not found (AC-7)", () => {
  it("is the 404 page for a username with no profile", async () => {
    await expect(BookRoute(props("nobody_here"))).rejects.toMatchObject(NOT_FOUND);
    expect(fakeSource.getPublishedBook).toHaveBeenCalledWith("nobody_here");
  });

  it.each(["Sample_Writer_Bilingual", "a", "has-dash", "x".repeat(31), "favicon.ico"])(
    "is the 404 page for the malformed username %s, without asking the source",
    async (username) => {
      await expect(BookRoute(props(username))).rejects.toMatchObject(NOT_FOUND);
      await expect(generateMetadata(props(username))).resolves.toEqual(await notFoundMetadata());
      expect(fakeSource.getPublishedBook).not.toHaveBeenCalled();
    },
  );

  // Thrown from generateMetadata, notFound() gives an empty error shell instead of the 404 page.
  it("uses the 404 page's noindex metadata rather than throw from generateMetadata", async () => {
    const metadata = await generateMetadata(props("nobody_here"));
    expect(metadata).toEqual(await notFoundMetadata());
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});

describe("/<username> metadata (AC-9)", () => {
  it.each(["en", "hi"] as const)("in %s, titles the document with the book, the writer and the app name", async (current) => {
    locale.current = current;
    const { config } = await import("@/config");
    const metadata = await generateMetadata(props(SAMPLE_USERNAMES.bilingual));
    const title = `${createTranslator(catalogues[current])("reader.documentTitle", {
      bookTitle: "नमूने की डायरी",
      writerName: "Sample Writer",
    })} · ${config.appName}`;
    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.alternates).toEqual({ canonical: `/${SAMPLE_USERNAMES.bilingual}` });
  });

  it("takes the app name from NEXT_PUBLIC_APP_NAME", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Kitaab Test");
    vi.resetModules();
    const fresh = await import("./page");
    const metadata = await fresh.generateMetadata(props(SAMPLE_USERNAMES.bilingual));
    expect(metadata.title).toEqual({ absolute: "नमूने की डायरी by Sample Writer · Kitaab Test" });
  });
});
