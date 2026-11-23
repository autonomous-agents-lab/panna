import { describe, expect, it } from "vitest";

import type { CurrentWriter, WritingRepository, WritingResult } from "@/contracts";
import { everyNode } from "@/contracts/page-body/__fixtures__/documents";

import { latestColumnDefault, readMigrations } from "../../../tests/support/migration-sql";

import { createInMemoryWritingRepository } from "./in-memory-repository";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const A: CurrentWriter = { userId: uuid(1), bookId: uuid(2) };
const B: CurrentWriter = { userId: uuid(3), bookId: uuid(4) };
const MISSING = uuid(999);

function setup() {
  let tick = 0;
  let nextId = 100;
  const repo = createInMemoryWritingRepository({
    books: [
      { id: A.bookId, userId: A.userId },
      { id: B.bookId, userId: B.userId },
    ],
    now: () => new Date(Date.UTC(2026, 10, 23, 10, 0, tick++)),
    newId: () => uuid(nextId++),
  });
  return repo;
}

function value<T>(result: WritingResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${result.error}`);
  return result.value;
}

const NOT_FOUND = { ok: false, error: "not_found" };
const INVALID_ORDER = { ok: false, error: "invalid_order" };
const PAGE_ARCHIVED = { ok: false, error: "page_archived" };

async function chapterWithPages(repo: WritingRepository, writer: CurrentWriter, pageCount: number) {
  const chapter = value(await repo.createChapter(writer, { title: "Chapter", language: "en" }));
  const pages = [];
  for (let i = 0; i < pageCount; i++) {
    pages.push(value(await repo.createPage(writer, { chapterId: chapter.id, language: "hi" })));
  }
  return { chapter, pages };
}

/** Everything a writer can see, including every page body. */
async function snapshot(repo: WritingRepository, writer: CurrentWriter) {
  const chapters = value(await repo.listChapters(writer));
  const pages = await Promise.all(
    chapters.flatMap((chapter) => chapter.pages).map(async (page) => value(await repo.getPageForEdit(writer, { pageId: page.id }))),
  );
  return { chapters, pages };
}

describe("createInMemoryWritingRepository", () => {
  it("starts with no chapters", async () => {
    expect(await setup().listChapters(A)).toEqual({ ok: true, value: [] });
  });

  it("creates draft chapters at the end, stamped with the clock", async () => {
    const repo = setup();
    const first = value(await repo.createChapter(A, { title: "एक", language: "hi" }));
    const second = value(await repo.createChapter(A, { title: "Two", language: "en" }));
    expect(first).toEqual({
      id: uuid(100),
      book_id: A.bookId,
      position: 0,
      title: "एक",
      status: "draft",
      published_at: null,
      archived_at: null,
      language: "hi",
      created_at: "2026-11-23T10:00:00.000Z",
      updated_at: "2026-11-23T10:00:00.000Z",
    });
    expect(second.position).toBe(1);
  });

  it("gives a book its first chapter with the first page, then adds pages to the last chapter", async () => {
    const repo = setup();
    const first = value(await repo.createPage(A, { firstChapterTitle: "पहला अध्याय", language: "hi" }));
    const [chapter] = value(await repo.listChapters(A));
    expect(chapter).toMatchObject({ title: "पहला अध्याय", language: "hi", position: 0 });
    expect(first).toMatchObject({ chapter_id: chapter?.id, position: 0, title: null, status: "draft" });

    const last = value(await repo.createChapter(A, { title: "Last", language: "en" }));
    const next = value(await repo.createPage(A, { firstChapterTitle: "unused", language: "en", title: "Hello" }));
    expect(next).toMatchObject({ chapter_id: last.id, position: 0, title: "Hello", language: "en" });
    expect(value(await repo.listChapters(A))).toHaveLength(2);
  });

  it("creates a page into a given chapter with the pages.body column default", async () => {
    const repo = setup();
    const { chapter, pages } = await chapterWithPages(repo, A, 2);
    expect(pages.map((page) => [page.chapter_id, page.position])).toEqual([
      [chapter.id, 0],
      [chapter.id, 1],
    ]);
    expect(pages[0]).toMatchObject({ book_id: A.bookId, published_at: null, archived_at: null, language: "hi" });
    expect(pages[0]?.body).toEqual(JSON.parse(latestColumnDefault(readMigrations(), "pages", "body")));
  });

  it("lists chapters by position with page summaries and their status", async () => {
    const repo = setup();
    const { chapter, pages } = await chapterWithPages(repo, A, 2);
    await repo.archivePage(A, { pageId: pages[1]!.id });
    const [listed] = value(await repo.listChapters(A));
    expect(listed).toEqual({
      ...chapter,
      pages: [
        { id: pages[0]!.id, chapter_id: chapter.id, position: 0, title: null, status: "draft", language: "hi", updated_at: pages[0]!.updated_at },
        expect.objectContaining({ id: pages[1]!.id, status: "archived" }),
      ],
    });
  });

  it("renames a chapter and a page, and clears a page title", async () => {
    const repo = setup();
    const { chapter, pages } = await chapterWithPages(repo, A, 1);
    const pageId = pages[0]!.id;
    const renamed = value(await repo.renameChapter(A, { chapterId: chapter.id, title: "नया नाम" }));
    expect(renamed).toMatchObject({ title: "नया नाम" });
    expect(renamed.updated_at > chapter.updated_at).toBe(true);
    expect(value(await repo.renamePage(A, { pageId, title: "Title" })).title).toBe("Title");
    expect(value(await repo.renamePage(A, { pageId, title: null })).title).toBeNull();
  });

  it("saves content and language, bumping updated_at", async () => {
    const repo = setup();
    const { pages } = await chapterWithPages(repo, A, 1);
    const pageId = pages[0]!.id;
    const saved = value(await repo.savePageContent(A, { pageId, body: everyNode }));
    expect(saved.body).toEqual(everyNode);
    expect(saved.updated_at > pages[0]!.updated_at).toBe(true);
    expect(value(await repo.setPageLanguage(A, { pageId, language: "en" })).language).toBe("en");
    expect(value(await repo.getPageForEdit(A, { pageId }))).toMatchObject({ body: everyNode, language: "en" });
  });

  it("publishes, keeps the first published_at on a repeat, and unpublishes", async () => {
    const repo = setup();
    const { pages } = await chapterWithPages(repo, A, 1);
    const pageId = pages[0]!.id;
    const published = value(await repo.publishPage(A, { pageId }));
    expect(published.status).toBe("published");
    expect(published.published_at).toEqual(published.updated_at);
    expect(value(await repo.publishPage(A, { pageId })).published_at).toBe(published.published_at);
    expect(value(await repo.unpublishPage(A, { pageId }))).toMatchObject({ status: "draft", published_at: null });
  });

  it("archives a page, refuses edits while archived, and restores it with the status it had", async () => {
    const repo = setup();
    const { pages } = await chapterWithPages(repo, A, 1);
    const pageId = pages[0]!.id;
    await repo.publishPage(A, { pageId });
    const archived = value(await repo.archivePage(A, { pageId }));
    expect(archived.archived_at).not.toBeNull();
    expect(value(await repo.archivePage(A, { pageId })).archived_at).toBe(archived.archived_at);

    const before = value(await repo.getPageForEdit(A, { pageId }));
    expect(await repo.publishPage(A, { pageId })).toEqual(PAGE_ARCHIVED);
    expect(await repo.unpublishPage(A, { pageId })).toEqual(PAGE_ARCHIVED);
    expect(await repo.savePageContent(A, { pageId, body: everyNode })).toEqual(PAGE_ARCHIVED);
    expect(await repo.renamePage(A, { pageId, title: "x" })).toEqual(PAGE_ARCHIVED);
    expect(await repo.setPageLanguage(A, { pageId, language: "en" })).toEqual(PAGE_ARCHIVED);
    expect(value(await repo.getPageForEdit(A, { pageId }))).toEqual(before);

    const restored = value(await repo.restorePage(A, { pageId }));
    expect(restored).toMatchObject({ archived_at: null, status: "published" });
    expect(value(await repo.listChapters(A))[0]?.pages[0]?.status).toBe("published");
  });

  it("hands out copies, so callers can't change the store", async () => {
    const repo = setup();
    const { pages } = await chapterWithPages(repo, A, 1);
    const pageId = pages[0]!.id;
    const body = structuredClone(everyNode);
    const saved = value(await repo.savePageContent(A, { pageId, body }));
    body.content.length = 0;
    saved.body.content.length = 0;
    saved.title = "changed";
    const listed = value(await repo.listChapters(A));
    listed[0]!.title = "changed";
    expect(value(await repo.getPageForEdit(A, { pageId }))).toMatchObject({ body: everyNode, title: null });
    expect(value(await repo.listChapters(A))[0]?.title).toBe("Chapter");
  });

  it("gives not_found for a chapter or page id that doesn't exist", async () => {
    const repo = setup();
    expect(await repo.renameChapter(A, { chapterId: MISSING, title: "x" })).toEqual(NOT_FOUND);
    expect(await repo.createPage(A, { chapterId: MISSING, language: "en" })).toEqual(NOT_FOUND);
    expect(await repo.getPageForEdit(A, { pageId: MISSING })).toEqual(NOT_FOUND);
  });
});

describe("two writers (AC-5)", () => {
  async function twoWriters() {
    const repo = setup();
    await chapterWithPages(repo, A, 1);
    const b = await chapterWithPages(repo, B, 2);
    await repo.publishPage(B, { pageId: b.pages[1]!.id });
    return { repo, chapterId: b.chapter.id, pageId: b.pages[0]!.id, pageIds: b.pages.map((page) => page.id) };
  }

  it("gives writer A not_found for every read or change of writer B's chapter or page, and B's data is unchanged", async () => {
    const { repo, chapterId, pageId, pageIds } = await twoWriters();
    const before = await snapshot(repo, B);

    const attempts = [
      repo.renameChapter(A, { chapterId, title: "taken" }),
      repo.reorderPages(A, { chapterId, pageIds: [...pageIds].reverse() }),
      repo.createPage(A, { chapterId, language: "en" }),
      repo.renamePage(A, { pageId, title: "taken" }),
      repo.getPageForEdit(A, { pageId }),
      repo.savePageContent(A, { pageId, body: everyNode }),
      repo.setPageLanguage(A, { pageId, language: "en" }),
      repo.publishPage(A, { pageId }),
      repo.unpublishPage(A, { pageId: pageIds[1]! }),
      repo.archivePage(A, { pageId }),
      repo.restorePage(A, { pageId }),
    ];
    for (const result of await Promise.all(attempts)) expect(result).toEqual(NOT_FOUND);

    expect(await snapshot(repo, B)).toEqual(before);
  });

  it("never lists writer B's rows for writer A", async () => {
    const { repo, chapterId, pageIds } = await twoWriters();
    const listed = value(await repo.listChapters(A));
    const ids = listed.flatMap((chapter) => [chapter.id, chapter.book_id, ...chapter.pages.map((page) => page.id)]);
    expect(ids).not.toContain(chapterId);
    expect(ids).not.toContain(B.bookId);
    for (const id of pageIds) expect(ids).not.toContain(id);
  });

  it.each([
    ["A's user id with B's book", { userId: A.userId, bookId: B.bookId }],
    ["a book the store doesn't know", { userId: A.userId, bookId: MISSING }],
  ])("treats %s as not found, and changes nothing", async (_, writer) => {
    const { repo, chapterId, pageId, pageIds } = await twoWriters();
    const before = await snapshot(repo, B);
    expect(await repo.listChapters(writer)).toEqual(NOT_FOUND);
    expect(await repo.createChapter(writer, { title: "x", language: "en" })).toEqual(NOT_FOUND);
    expect(await repo.reorderChapters(writer, { chapterIds: [chapterId] })).toEqual(NOT_FOUND);
    expect(await repo.createPage(writer, { firstChapterTitle: "x", language: "en" })).toEqual(NOT_FOUND);
    expect(await repo.reorderPages(writer, { chapterId, pageIds })).toEqual(NOT_FOUND);
    expect(await repo.getPageForEdit(writer, { pageId })).toEqual(NOT_FOUND);
    expect(await snapshot(repo, B)).toEqual(before);
  });
});

describe("reordering (AC-6)", () => {
  async function bookWithChapters() {
    const repo = setup();
    const first = await chapterWithPages(repo, A, 3);
    const second = await chapterWithPages(repo, A, 1);
    const other = await chapterWithPages(repo, B, 1);
    return { repo, first, second, other };
  }
  const positions = (rows: { id: string; position: number }[]) => rows.map((row) => [row.id, row.position]);

  it("rewrites chapter positions to 0..n-1 in the requested order", async () => {
    const { repo, first, second } = await bookWithChapters();
    const third = value(await repo.createChapter(A, { title: "Three", language: "en" }));
    const ordered = value(await repo.reorderChapters(A, { chapterIds: [third.id, first.chapter.id, second.chapter.id] }));
    expect(positions(ordered)).toEqual([
      [third.id, 0],
      [first.chapter.id, 1],
      [second.chapter.id, 2],
    ]);
    expect(positions(value(await repo.listChapters(A)))).toEqual(positions(ordered));
  });

  it("rewrites page positions, archived pages included, and appends after them", async () => {
    const { repo, first } = await bookWithChapters();
    const [p0, p1, p2] = first.pages.map((page) => page.id) as [string, string, string];
    await repo.archivePage(A, { pageId: p1 });
    const ordered = value(await repo.reorderPages(A, { chapterId: first.chapter.id, pageIds: [p2, p1, p0] }));
    expect(positions(ordered)).toEqual([
      [p2, 0],
      [p1, 1],
      [p0, 2],
    ]);
    expect(ordered[1]?.status).toBe("archived");
    const appended = value(await repo.createPage(A, { chapterId: first.chapter.id, language: "en" }));
    expect(appended.position).toBe(3);
  });

  it("is stable: the same order changes no row", async () => {
    const { repo, first } = await bookWithChapters();
    const before = await snapshot(repo, A);
    const ids = first.pages.map((page) => page.id);
    value(await repo.reorderPages(A, { chapterId: first.chapter.id, pageIds: ids }));
    value(await repo.reorderChapters(A, { chapterIds: before.chapters.map((chapter) => chapter.id) }));
    expect(await snapshot(repo, A)).toEqual(before);
  });

  it("touches only the rows whose position changes", async () => {
    const { repo, first } = await bookWithChapters();
    const [p0, p1, p2] = first.pages;
    const ordered = value(await repo.reorderPages(A, { chapterId: first.chapter.id, pageIds: [p0!.id, p2!.id, p1!.id] }));
    expect(ordered[0]?.updated_at).toBe(p0!.updated_at);
    expect(ordered[1]?.updated_at).not.toBe(p2!.updated_at);
  });

  it("rejects ids from another chapter or book, missing ids and repeats, changing nothing", async () => {
    const { repo, first, second, other } = await bookWithChapters();
    const before = await snapshot(repo, A);
    const [p0, p1, p2] = first.pages.map((page) => page.id) as [string, string, string];
    const chapterId = first.chapter.id;

    const pageOrders = [
      [p0, p1, second.pages[0]!.id],
      [p0, p1, p2, second.pages[0]!.id],
      [p0, p1, other.pages[0]!.id],
      [p0, p1],
      [p0, p1, p1],
    ];
    for (const pageIds of pageOrders) expect(await repo.reorderPages(A, { chapterId, pageIds })).toEqual(INVALID_ORDER);

    const chapterOrders = [[first.chapter.id, other.chapter.id], [first.chapter.id], [first.chapter.id, first.chapter.id]];
    for (const chapterIds of chapterOrders) expect(await repo.reorderChapters(A, { chapterIds })).toEqual(INVALID_ORDER);

    expect(await snapshot(repo, A)).toEqual(before);
  });
});
