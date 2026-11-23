import { describe, expect, it } from "vitest";

import type { ChapterWithPages, PageSummary } from "@/contracts";

import { titleLang, toDashboardView } from "./view";

const AT = "2026-11-23T10:00:00.000Z";

function page(id: string, chapterId: string, position: number, status: PageSummary["status"]): PageSummary {
  return { id, chapter_id: chapterId, position, title: `Page ${id}`, status, language: "en", updated_at: AT };
}

function chapter(id: string, position: number, title: string, pages: PageSummary[]): ChapterWithPages {
  return {
    id,
    book_id: "book",
    position,
    title,
    status: "draft",
    published_at: null,
    archived_at: null,
    language: "hi",
    created_at: AT,
    updated_at: AT,
    pages,
  };
}

describe("toDashboardView (AC-2)", () => {
  it("keeps chapters and their pages in order, and moves archived pages to their own list with their chapter", () => {
    const view = toDashboardView([
      chapter("c1", 0, "पहला", [page("a", "c1", 0, "draft"), page("b", "c1", 1, "archived"), page("c", "c1", 2, "published")]),
      chapter("c2", 1, "Second", [page("d", "c2", 0, "archived")]),
      chapter("c3", 2, "Third", []),
    ]);

    expect(view.chapters.map((c) => [c.id, c.title, c.language, c.pages.map((p) => p.id)])).toEqual([
      ["c1", "पहला", "hi", ["a", "c"]],
      ["c2", "Second", "hi", []],
      ["c3", "Third", "hi", []],
    ]);
    expect(view.archived).toEqual([
      { ...page("b", "c1", 1, "archived"), chapterTitle: "पहला", chapterLanguage: "hi" },
      { ...page("d", "c2", 0, "archived"), chapterTitle: "Second", chapterLanguage: "hi" },
    ]);
  });

  it("is empty for a book with no chapters", () => {
    expect(toDashboardView([])).toEqual({ chapters: [], archived: [] });
  });
});

describe("titleLang (AC-6)", () => {
  it.each([
    ["पहला अध्याय", "en", "hi"],
    ["Chapter एक", "en", "hi"],
    ["Chapter one", "en", "en"],
    ["Pehla adhyay", "hi", "hi"],
    ["2026", "en", "en"],
  ] as const)("gives %j (item language %s) lang=%s", (title, fallback, expected) => {
    expect(titleLang(title, fallback)).toBe(expected);
  });
});
