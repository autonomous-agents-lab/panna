import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { sampleBookStore, SAMPLE_IDS, SAMPLE_USERNAMES } from "@/lib/reader/fixtures";
import { toReaderBook, toReaderPage } from "@/lib/reader/project";

import {
  chapterSchema,
  pageSchema,
  readerBookSchema,
  readerPageViewSchema,
  richTextDocSchema,
  richTextPlainText,
  type ReaderBook,
  type RichTextDoc,
} from "./index";

const readerBook: ReaderBook = {
  writer: { username: "asha_k", display_name: "आशा", bio: null, photo_url: "https://example.org/a.png" },
  book: {
    id: "0f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
    title: "आशा",
    subtitle: null,
    cover_style: "classic",
    font: "kalam",
    default_language: "hi",
  },
  chapters: [
    {
      id: "1f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
      title: "One",
      pages: [
        {
          id: "2f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
          title: null,
          language: "hi",
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "नमस्ते" }] }] },
          published_at: "2026-11-23T10:00:00+00:00",
        },
      ],
    },
  ],
};

const page = readerBook.chapters[0]!.pages[0]!;

/** A deep copy with one field removed, by path. */
function without(value: unknown, path: (string | number)[]): unknown {
  const copy = structuredClone(value) as Record<string | number, unknown>;
  const parent = path.slice(0, -1).reduce<Record<string | number, unknown>>(
    (node, key) => node[key] as Record<string | number, unknown>,
    copy,
  );
  delete parent[path.at(-1)!];
  return copy;
}

const pageRow = {
  id: page.id,
  chapter_id: readerBook.chapters[0]!.id,
  title: null,
  language: "hi",
  content: page.content,
  position: 0,
  status: "published",
  published_at: page.published_at,
  created_at: page.published_at,
  updated_at: page.published_at,
  archived_at: null,
};

const chapterRow = {
  id: readerBook.chapters[0]!.id,
  book_id: readerBook.book.id,
  title: "One",
  position: 0,
  created_at: page.published_at,
  updated_at: page.published_at,
  archived_at: null,
};

describe("readerBookSchema (AC-1)", () => {
  it("parses a hand-built ReaderBook", () => {
    expect(readerBookSchema.parse(readerBook)).toEqual(readerBook);
  });

  it.each(Object.values(SAMPLE_USERNAMES))("parses the %s fixture book", (username) => {
    const book = toReaderBook(sampleBookStore, username);
    expect(readerBookSchema.parse(book)).toEqual(book);
  });

  it("parses a fixture page view", () => {
    const view = toReaderPage(sampleBookStore, SAMPLE_USERNAMES.bilingual, SAMPLE_IDS.bilingual.pages.rainEnglish);
    expect(readerPageViewSchema.parse(view)).toEqual(view);
  });

  it.each([
    ["the book title", ["book", "title"]],
    ["the writer's display name", ["writer", "display_name"]],
    ["the writer's photo URL", ["writer", "photo_url"]],
    ["a page's content", ["chapters", 0, "pages", 0, "content"]],
    ["a page's published date", ["chapters", 0, "pages", 0, "published_at"]],
    ["a page's language", ["chapters", 0, "pages", 0, "language"]],
    ["a chapter's pages", ["chapters", 0, "pages"]],
  ])("fails with a validation error without %s", (_what, path) => {
    expect(() => readerBookSchema.parse(without(readerBook, path))).toThrow(ZodError);
  });

  it("rejects a blank title, an unpublished page, a private field and a non-web photo URL", () => {
    expect(readerBookSchema.safeParse({ ...readerBook, book: { ...readerBook.book, title: " " } }).success).toBe(false);
    const unpublished = structuredClone(readerBook);
    (unpublished.chapters[0]!.pages[0] as { published_at: string | null }).published_at = null;
    expect(readerBookSchema.safeParse(unpublished).success).toBe(false);
    expect(
      readerBookSchema.safeParse({ ...readerBook, book: { ...readerBook.book, owner_id: readerBook.book.id } }).success,
    ).toBe(false);
    expect(
      readerBookSchema.safeParse({ ...readerBook, writer: { ...readerBook.writer, photo_url: "javascript:alert(1)" } })
        .success,
    ).toBe(false);
  });

  it("requires the page view's chapter and page", () => {
    const view = { writer: readerBook.writer, book: readerBook.book, chapter: { id: chapterRow.id, title: "One" }, page };
    expect(readerPageViewSchema.parse(view)).toEqual(view);
    expect(readerPageViewSchema.safeParse(without(view, ["chapter"])).success).toBe(false);
    expect(readerPageViewSchema.safeParse(without(view, ["page", "content"])).success).toBe(false);
  });
});

describe("richTextDocSchema: the whitelist is the sanitising", () => {
  const doc: RichTextDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "bold", marks: [{ type: "bold" }, { type: "italic" }] },
          { type: "hard_break" },
          { type: "text", text: "next line" },
        ],
      },
      { type: "paragraph" },
      { type: "blockquote", content: [{ type: "blockquote", content: [{ type: "paragraph" }] }] },
    ],
  };

  const paragraphWith = (inline: unknown) => ({ type: "doc", content: [{ type: "paragraph", content: [inline] }] });

  it("parses every allowed node and mark, with nested quotes", () => {
    expect(richTextDocSchema.parse(doc)).toEqual(doc);
    expect(richTextDocSchema.parse({ type: "doc", content: [] })).toEqual({ type: "doc", content: [] });
  });

  it.each([
    ["a script block", { type: "doc", content: [{ type: "script", content: [] }] }],
    ["an html block", { type: "doc", content: [{ type: "html", html: "<b>x</b>" }] }],
    ["a link mark", paragraphWith({ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "https://x" } }] })],
    ["an attribute on a mark", paragraphWith({ type: "text", text: "x", marks: [{ type: "bold", attrs: {} }] })],
    ["an image inline", paragraphWith({ type: "image", attrs: { src: "x" } })],
    ["an extra key on text", paragraphWith({ type: "text", text: "x", onclick: "y" })],
    ["empty text", paragraphWith({ type: "text", text: "" })],
    ["a level 1 heading", { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] }],
    ["a level 5 heading", { type: "doc", content: [{ type: "heading", attrs: { level: 5 } }] }],
    ["an empty quote", { type: "doc", content: [{ type: "blockquote", content: [] }] }],
    ["another root", { type: "paragraph" }],
  ])("rejects %s", (_what, value) => {
    expect(richTextDocSchema.safeParse(value).success).toBe(false);
  });

  it("gives plain text with blank lines between blocks and line breaks kept", () => {
    expect(richTextPlainText(doc)).toBe("Title\n\nbold\nnext line\n\n\n\n");
    expect(
      richTextPlainText({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "a" }] },
          { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] },
        ],
      }),
    ).toBe("a\n\nb");
  });
});

describe("chapter and page row schemas", () => {
  it("parse valid rows", () => {
    expect(chapterSchema.parse(chapterRow)).toEqual(chapterRow);
    expect(pageSchema.parse(pageRow)).toEqual(pageRow);
    expect(pageSchema.parse({ ...pageRow, status: "draft", published_at: null })).toMatchObject({ status: "draft" });
  });

  it.each([
    ["a bad status", { status: "scheduled" }],
    ["a bad language", { language: "fr" }],
    ["unsafe content", { content: { type: "doc", content: [{ type: "script" }] } }],
    ["a negative position", { position: -1 }],
    ["a fractional position", { position: 1.5 }],
    ["a blank title", { title: "\t" }],
    ["an unknown column", { author_email: "a@example.org" }],
  ])("reject a page with %s", (_what, change) => {
    expect(pageSchema.safeParse({ ...pageRow, ...change }).success).toBe(false);
  });

  it("requires page content", () => {
    expect(() => pageSchema.parse(without(pageRow, ["content"]))).toThrow(ZodError);
  });

  it.each([
    ["a blank title", { title: " " }],
    ["a title over the limit", { title: "x".repeat(101) }],
    ["a bad book id", { book_id: "nope" }],
  ])("reject a chapter with %s", (_what, change) => {
    expect(chapterSchema.safeParse({ ...chapterRow, ...change }).success).toBe(false);
  });
});
