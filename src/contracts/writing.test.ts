import { describe, expect, expectTypeOf, it } from "vitest";

import { PAGE_TITLE_LIMIT } from "@/config/writing";

import type { Chapter as Book19Chapter } from "./chapter";
import type { CurrentWriter } from "./current-writer";
import {
  PAGE_STATUSES,
  WRITING_ERROR_CODES,
  currentWriterSchema,
  pageStatusOf,
  pageStatusSchema,
  sanitisePageBody,
  sanitiseRichText,
  writingInputSchemas,
  type Chapter,
  type ChapterWithPages,
  type GetCurrentWriter,
  type Page,
  type PageStatus,
  type RichTextDocument,
  type WritingPage,
  type WritingRepository,
  type WritingResult,
} from "./index";
import type { Page as Book19Page } from "./page";
import { everyNode, imageUrl, options } from "./page-body/__fixtures__/documents";
import type { PageBody } from "./page-body";

const schemas = writingInputSchemas(options);
const ID = "4f0c9a3e-8a7b-4c39-9b1e-2d8f6a5c7e10";

const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("the writing contract (AC-1)", () => {
  it("exports the helpers and a schema for every repository input", () => {
    expect(PAGE_STATUSES).toEqual(["draft", "published", "archived"]);
    expect(pageStatusSchema.options).toEqual([...PAGE_STATUSES]);
    expect(WRITING_ERROR_CODES).toEqual(["not_found", "invalid_input", "invalid_order", "page_archived"]);
    expect(Object.keys(schemas).sort()).toEqual(
      [
        "archivePage",
        "createChapter",
        "createPage",
        "getPageForEdit",
        "publishPage",
        "renameChapter",
        "renamePage",
        "reorderChapters",
        "reorderPages",
        "restorePage",
        "savePageContent",
        "setPageLanguage",
        "unpublishPage",
      ].sort(),
    );
    expect(currentWriterSchema.parse({ userId: ID, bookId: ID })).toEqual({ userId: ID, bookId: ID });
  });

  it("reuses BOOK-19's chapter, page and body types unchanged", () => {
    expectTypeOf<Chapter>().toEqualTypeOf<Book19Chapter>();
    expectTypeOf<Page>().toEqualTypeOf<Book19Page>();
    expectTypeOf<RichTextDocument>().toEqualTypeOf<PageBody>();
    expectTypeOf<WritingPage>().toEqualTypeOf<Book19Page & { title: string | null }>();
    expectTypeOf<ChapterWithPages["pages"][number]["status"]>().toEqualTypeOf<PageStatus>();
    expectTypeOf<PageStatus>().toEqualTypeOf<"draft" | "published" | "archived">();
    expectTypeOf<GetCurrentWriter>().toEqualTypeOf<() => Promise<CurrentWriter | null>>();
  });

  it("has exactly the fourteen repository methods, each returning a WritingResult", () => {
    expectTypeOf<keyof WritingRepository>().toEqualTypeOf<
      | "listChapters"
      | "createChapter"
      | "renameChapter"
      | "reorderChapters"
      | "createPage"
      | "renamePage"
      | "reorderPages"
      | "getPageForEdit"
      | "savePageContent"
      | "setPageLanguage"
      | "publishPage"
      | "unpublishPage"
      | "archivePage"
      | "restorePage"
    >();
    expectTypeOf<Awaited<ReturnType<WritingRepository["getPageForEdit"]>>>().toEqualTypeOf<WritingResult<WritingPage>>();
    expectTypeOf<Parameters<WritingRepository["listChapters"]>>().toEqualTypeOf<[writer: CurrentWriter]>();
  });

  it.each([
    [{ status: "draft", archived_at: null }, "draft"],
    [{ status: "published", archived_at: null }, "published"],
    [{ status: "draft", archived_at: "2026-11-23T10:00:00Z" }, "archived"],
    [{ status: "published", archived_at: "2026-11-23T10:00:00Z" }, "archived"],
  ] as const)("pageStatusOf(%j) is %s: archived wins over the row's status", (page, expected) => {
    expect(pageStatusOf(page)).toBe(expected);
  });
});

describe("the writing input schemas", () => {
  it("trims titles and accepts them up to their limits", () => {
    const title = "क".repeat(PAGE_TITLE_LIMIT.max);
    expect(schemas.renamePage.parse({ pageId: ID, title: `  ${title} ` })).toEqual({ pageId: ID, title });
    expect(schemas.createChapter.parse({ title: " पहला अध्याय ", language: "hi" })).toEqual({
      title: "पहला अध्याय",
      language: "hi",
    });
  });

  it("lets a page title be cleared with null", () => {
    expect(schemas.renamePage.parse({ pageId: ID, title: null })).toEqual({ pageId: ID, title: null });
  });

  it("takes a page into a chapter, or into the last chapter with a first chapter title", () => {
    expect(schemas.createPage.parse({ chapterId: ID, language: "en" })).toEqual({ chapterId: ID, language: "en" });
    expect(schemas.createPage.parse({ firstChapterTitle: "One", language: "en", title: "Hi" })).toEqual({
      firstChapterTitle: "One",
      language: "en",
      title: "Hi",
    });
    expect(schemas.createPage.safeParse({ language: "en" }).success).toBe(false);
  });

  it("rejects an order that repeats an id", () => {
    expect(schemas.reorderPages.safeParse({ chapterId: ID, pageIds: [ID, ID] }).success).toBe(false);
    expect(schemas.reorderChapters.safeParse({ chapterIds: [] }).success).toBe(false);
  });

  it("sanitises a body as it parses it", () => {
    const parsed = schemas.savePageContent.parse({ pageId: ID, body: doc({ type: "script" }, ...everyNode.content) });
    expect(parsed.body).toEqual(everyNode);
  });
});

describe("sanitiseRichText (AC-2)", () => {
  const sanitise = (input: unknown) => {
    const result = sanitiseRichText(input, options);
    if (!result.ok) throw new Error(`Rejected: ${result.code}`);
    return result.body;
  };
  const text = (value: string) => ({ type: "paragraph", content: [{ type: "text", text: value }] });

  it("is BOOK-19's sanitiser, so there is one set of rules", () => {
    expect(sanitiseRichText).toBe(sanitisePageBody);
  });

  it("keeps every allowed node and mark unchanged", () => {
    expect(sanitise(everyNode)).toEqual(everyNode);
  });

  it("removes a script node and its content", () => {
    const body = sanitise(doc(text("before"), { type: "script", content: [{ type: "text", text: "alert(1)" }] }));
    expect(body).toEqual(doc(text("before")));
  });

  it("strips on* attributes from a paragraph and an image, keeping the nodes", () => {
    const src = imageUrl("user-1/a.webp");
    const body = sanitise(
      doc(
        { type: "paragraph", attrs: { onclick: "alert(1)" }, content: [{ type: "text", text: "hi" }] },
        { type: "image", attrs: { src, alt: "a cat", onerror: "alert(1)", onload: "x()" } },
        { type: "text", text: "loose", onmouseover: "x()" },
      ),
    );
    expect(body).toEqual(doc(text("hi"), { type: "image", attrs: { src, alt: "a cat" } }));
  });

  it("drops a javascript: link mark and its href, keeping the text", () => {
    const body = sanitise(
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "click",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "bold" }],
          },
        ],
      }),
    );
    expect(body).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "click", marks: [{ type: "bold" }] }] }));
  });

  it("removes raw HTML and unknown node types", () => {
    const body = sanitise(
      doc(
        { type: "html", content: '<img src=x onerror="alert(1)">' },
        { type: "rawHtml", html: "<b>x</b>" },
        { type: "iframe", attrs: { src: "javascript:alert(1)" } },
        { type: "paragraph", content: [{ type: "html", text: "<script>" }, { type: "text", text: "kept" }] },
      ),
    );
    expect(body).toEqual(doc(text("kept")));
  });

  it("keeps angle brackets typed in text as text; the renderer escapes them", () => {
    expect(sanitise(doc(text("a <b> & </p>")))).toEqual(doc(text("a <b> & </p>")));
  });
});

describe("sanitiseRichText on Hindi and English text (AC-3)", () => {
  const samples = [
    // Matras, anusvara and virama conjuncts.
    "क्षत्रिय की कहानी, संस्कृत में।",
    // Nukta, both precomposed (U+095B) and as a combining mark (U+091C U+093C).
    "ज़िंदगी और ज़िंदगी",
    // ZWJ (U+200D) and ZWNJ (U+200C) change how a conjunct is drawn.
    "क्‍ष and क्‌ष, र्‍य",
    "Mixed: नमस्ते, world! café",
  ];

  it.each(samples)("leaves %j byte-for-byte unchanged", (sample) => {
    const result = sanitiseRichText(
      doc({ type: "paragraph", content: [{ type: "text", text: sample, marks: [{ type: "italic" }] }] }),
      options,
    );
    if (!result.ok) throw new Error(result.code);
    const [paragraph] = result.body.content;
    const out = paragraph?.type === "paragraph" ? paragraph.content?.[0] : undefined;
    const outText = out?.type === "text" ? out.text : "";
    expect(Buffer.from(outText, "utf8").equals(Buffer.from(sample, "utf8"))).toBe(true);
  });

  it("really contains the combining marks and joiners it claims to", () => {
    const all = samples.join("");
    for (const codePoint of ["़", "्", "‌", "‍", "́"]) expect(all).toContain(codePoint);
  });
});
