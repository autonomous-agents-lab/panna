import { describe, expect, it } from "vitest";

import { richTextPlainText, type Page } from "@/contracts";

import { HIDDEN_MARKERS, SAMPLE_IDS, SAMPLE_USERNAMES, sampleBookStore } from "./fixtures";
import { isPublished, toReaderBook, toReaderPage, type BookStore } from "./project";

const ids = SAMPLE_IDS;
const store = sampleBookStore;

const withStore = (change: (copy: BookStore) => void): BookStore => {
  const copy = structuredClone(store);
  change(copy);
  return copy;
};

const bookText = (username: string) => JSON.stringify(toReaderBook(store, username));

describe("isPublished", () => {
  const published = store.pages.find((page) => page.id === ids.drafts.pages.published)!;

  it.each<[string, Partial<Page>, boolean]>([
    ["a published, dated, live page", {}, true],
    ["a draft", { status: "draft" }, false],
    ["a published page without a date", { published_at: null }, false],
    ["an archived page", { archived_at: "2026-11-12T09:00:00+00:00" }, false],
  ])("%s → %s", (_what, change, expected) => {
    expect(isPublished({ ...published, ...change })).toBe(expected);
  });
});

describe("toReaderBook", () => {
  it("gives the bilingual book with chapters and pages in position order, not row order", () => {
    const book = toReaderBook(store, SAMPLE_USERNAMES.bilingual)!;
    expect(book.writer).toEqual({
      username: SAMPLE_USERNAMES.bilingual,
      display_name: "Sample Writer",
      bio: expect.stringContaining("Not a real person"),
      photo_url: null,
    });
    expect(book.book).toEqual({
      id: ids.bilingual.book,
      title: "नमूने की डायरी",
      subtitle: "A sample notebook in two languages",
      cover_style: "classic",
      font: "kalam",
      default_language: "hi",
    });
    const { chapters, pages } = ids.bilingual;
    expect(book.chapters.map((chapter) => chapter.id)).toEqual([chapters.morning, chapters.rain, chapters.evening]);
    expect(book.chapters.map((chapter) => chapter.pages.map((page) => page.id))).toEqual([
      [pages.morningHindi, pages.morningEnglish],
      [pages.rainEnglish],
      [pages.eveningHindi, pages.eveningEnglish],
    ]);
    expect(book.chapters[0]!.pages.map((page) => page.language)).toEqual(["hi", "en"]);
  });

  it("has long, multi-paragraph pages", () => {
    const [first] = toReaderBook(store, SAMPLE_USERNAMES.bilingual)!.chapters[0]!.pages;
    expect(first!.content.content.length).toBeGreaterThanOrEqual(3);
    expect(richTextPlainText(first!.content).length).toBeGreaterThan(400);
  });

  it("leaves out drafts, unpublished and archived pages, archived chapters, and private columns", () => {
    const book = toReaderBook(store, SAMPLE_USERNAMES.drafts)!;
    expect(book.chapters.map((chapter) => chapter.id)).toEqual([ids.drafts.chapters.live]);
    expect(book.chapters[0]!.pages.map((page) => page.id)).toEqual([ids.drafts.pages.published]);
    const text = bookText(SAMPLE_USERNAMES.drafts);
    for (const marker of Object.values(HIDDEN_MARKERS)) expect(text).not.toContain(marker);
    for (const column of ["status", "position", "archived_at", "owner_id", "avatar_path", "deactivated_at"]) {
      expect(text).not.toContain(`"${column}"`);
    }
  });

  it("gives a book with no published pages, and no empty chapter headings", () => {
    const book = toReaderBook(store, SAMPLE_USERNAMES.empty)!;
    expect(book.book.title).toBe("An Empty Sample Book");
    expect(book.chapters).toEqual([]);
  });

  it("is null for an unknown username", () => {
    expect(toReaderBook(store, "nobody_here")).toBeNull();
  });

  it("is null for a deactivated writer", () => {
    const deactivated = withStore((copy) => {
      copy.profiles[0]!.deactivated_at = "2026-11-20T09:00:00+00:00";
    });
    expect(toReaderBook(deactivated, SAMPLE_USERNAMES.bilingual)).toBeNull();
    expect(toReaderPage(deactivated, SAMPLE_USERNAMES.bilingual, ids.bilingual.pages.rainEnglish)).toBeNull();
  });

  it("is null for a writer without a book", () => {
    const bookless = withStore((copy) => {
      copy.books = copy.books.filter((book) => book.owner_id !== ids.bilingual.profile);
    });
    expect(toReaderBook(bookless, SAMPLE_USERNAMES.bilingual)).toBeNull();
  });

  it("fails loudly rather than show a page whose row breaks the reader contract", () => {
    const broken = withStore((copy) => {
      (copy.pages[0] as { language: string }).language = "fr";
    });
    expect(() => toReaderBook(broken, SAMPLE_USERNAMES.bilingual)).toThrow();
  });
});

describe("toReaderPage", () => {
  it("gives a published page with its writer, book and chapter", () => {
    const view = toReaderPage(store, SAMPLE_USERNAMES.bilingual, ids.bilingual.pages.rainEnglish)!;
    expect(view.writer.username).toBe(SAMPLE_USERNAMES.bilingual);
    expect(view.book.id).toBe(ids.bilingual.book);
    expect(view.chapter).toEqual({ id: ids.bilingual.chapters.rain, title: "बारिश / Rain" });
    expect(view.page).toMatchObject({ id: ids.bilingual.pages.rainEnglish, language: "en", title: "Sample notes on rain" });
  });

  it.each([
    ["a draft", ids.drafts.pages.draft],
    ["an unpublished page", ids.drafts.pages.unpublished],
    ["an archived page", ids.drafts.pages.archived],
    ["a page in an archived chapter", ids.drafts.pages.inArchivedChapter],
    ["an unknown id", "5d000000-0000-4000-8000-00000000ffff"],
    ["another writer's page", ids.bilingual.pages.rainEnglish],
  ])("is null for %s", (_what, pageId) => {
    expect(toReaderPage(store, SAMPLE_USERNAMES.drafts, pageId)).toBeNull();
  });

  it("is null for an unknown writer", () => {
    expect(toReaderPage(store, "nobody_here", ids.bilingual.pages.rainEnglish)).toBeNull();
  });
});
