import { describe, expect, it } from "vitest";

import { IMAGE_ALT_MAX_LENGTH, PAGE_BODY_MAX_BYTES, PAGE_BODY_MAX_DEPTH } from "@/config/content";

import { everyNode, imageUrl, options } from "./__fixtures__/documents";
import { PAGE_BODY_ERROR_CODES } from "./errors";
import { sanitisePageBody } from "./sanitise";
import { pageBodyByteLength, pageBodySchema } from "./schema";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: unknown) => ({ type: "text", text: value, ...(marks === undefined ? {} : { marks }) });
const image = (attrs: unknown) => ({ type: "image", attrs });
const goodImage = { src: imageUrl("u/a.webp"), alt: "A cup of tea" };
const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** The sanitised body, after checking it is accepted by pageBodySchema unchanged. */
function clean(input: unknown) {
  const result = sanitisePageBody(input, options);
  if (!result.ok) throw new Error(`Expected a body, got ${result.code} at ${result.path.join(".")}`);
  expect(pageBodySchema.parse(result.body)).toEqual(result.body);
  return result.body;
}

const rejection = (input: unknown) => {
  const result = sanitisePageBody(input, options);
  return result.ok ? result : { code: result.code, path: result.path };
};

/** Objects nested `depth` levels deep, counting the doc itself as 1. */
function nested(depth: number) {
  let value: Record<string, unknown> = {};
  for (let level = 3; level < depth; level++) value = { a: value };
  return doc(value);
}

describe("sanitisePageBody keeps what is allowed", () => {
  it("returns a valid document unchanged, Hindi and English, every node and mark", () => {
    expect(clean(everyNode)).toEqual(everyNode);
  });

  it("returns new objects, never the input", () => {
    const input = structuredClone(everyNode);
    expect(clean(input)).not.toBe(input);
  });

  it("keeps text that looks like HTML as text", () => {
    expect(clean(doc(paragraph(text("<script>alert(1)</script>"))))).toEqual(
      doc(paragraph(text("<script>alert(1)</script>"))),
    );
  });

  it("accepts the database's default body", () => {
    expect(clean(EMPTY_DOC)).toEqual(EMPTY_DOC);
  });
});

describe("sanitisePageBody strips what is not allowed (AC-5)", () => {
  it("strips unknown nodes, script and iframe included, with their content", () => {
    const input = doc(
      { type: "script", content: [text("alert(1)")] },
      { type: "iframe", attrs: { src: "https://evil.example" } },
      { type: "codeBlock", content: [text("rm -rf")] },
      paragraph(text("kept")),
    );
    expect(clean(input)).toEqual(doc(paragraph(text("kept"))));
  });

  it("strips allowed nodes in the wrong place: inline at the top, blocks inside a paragraph", () => {
    const input = doc(
      text("loose text"),
      { type: "hardBreak" },
      paragraph(text("a"), { type: "heading", attrs: { level: 2 }, content: [text("b")] }, image(goodImage)),
    );
    expect(clean(input)).toEqual(doc(paragraph(text("a"))));
  });

  it("strips anything in a blockquote but paragraphs, and a blockquote left empty", () => {
    const input = doc(
      { type: "blockquote", content: [paragraph(text("q")), image(goodImage), { type: "blockquote", content: [paragraph(text("deep"))] }, "x"] },
      { type: "blockquote", content: [{ type: "heading", attrs: { level: 2 } }] },
      { type: "blockquote" },
    );
    expect(clean(input)).toEqual(doc({ type: "blockquote", content: [paragraph(text("q"))] }));
  });

  it("strips non-object children", () => {
    expect(clean(doc(null, "text", 3, [paragraph()], paragraph(null, "x", text("ok"))))).toEqual(doc(paragraph(text("ok"))));
  });

  it("strips event handlers, styles and other unknown attributes and keys", () => {
    const input = {
      type: "doc",
      attrs: { onload: "alert(1)" },
      content: [
        { type: "paragraph", attrs: { style: "color:red", onclick: "alert(1)" }, marks: [], content: [text("p")] },
        { type: "heading", attrs: { level: 2, onmouseover: "alert(1)", id: "x" }, content: [text("h")] },
        { type: "blockquote", attrs: { class: "x" }, content: [{ type: "paragraph", attrs: { style: "x" } }] },
        image({ ...goodImage, title: "t", onerror: "alert(1)", width: 10 }),
        { type: "text", text: "x", extra: true },
      ],
      extra: "x",
    };
    expect(clean(input)).toEqual(
      doc(
        paragraph(text("p")),
        { type: "heading", attrs: { level: 2 }, content: [text("h")] },
        { type: "blockquote", content: [{ type: "paragraph" }] },
        image(goodImage),
      ),
    );
  });

  it("strips unknown marks (links included), mark attributes and repeats, and orders marks bold then italic", () => {
    const input = doc(
      paragraph(
        text("link", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
        text("both", [{ type: "italic" }, { type: "underline" }, { type: "bold", attrs: { x: 1 } }, { type: "italic" }]),
        text("junk", [null, "bold", 3]),
        text("not a list", { type: "bold" }),
      ),
    );
    expect(clean(input)).toEqual(
      doc(paragraph(text("link"), text("both", [{ type: "bold" }, { type: "italic" }]), text("junk"), text("not a list"))),
    );
  });

  it("strips empty, non-string and unknown inline nodes, and marks on a hard break", () => {
    const input = doc(
      paragraph(
        text(""),
        { type: "text" },
        { type: "text", text: 42 },
        { type: "mention", attrs: { id: "x" } },
        { type: "hardBreak", marks: [{ type: "bold" }], attrs: { x: 1 } },
      ),
    );
    expect(clean(input)).toEqual(doc(paragraph({ type: "hardBreak" })));
  });

  it("removes characters Postgres can't store: NUL, and unpaired surrogates become U+FFFD", () => {
    expect(clean(doc(paragraph(text("a\0b"), text("\0"), text("x\uD800y"))))).toEqual(
      doc(paragraph(text("ab"), text("x�y"))),
    );
  });

  it("gives a doc with nothing left one empty paragraph, as does a doc without content", () => {
    expect(clean(doc({ type: "script" }))).toEqual(EMPTY_DOC);
    expect(clean({ type: "doc" })).toEqual(EMPTY_DOC);
    expect(clean({ type: "doc", content: "not a list" })).toEqual(EMPTY_DOC);
  });

  it("keeps a body that is small once stripped, however large the junk was", () => {
    const input = doc({ type: "script", content: [text("x".repeat(PAGE_BODY_MAX_BYTES))] }, paragraph(text("kept")));
    expect(clean(input)).toEqual(doc(paragraph(text("kept"))));
  });
});

describe("sanitisePageBody clamps heading levels", () => {
  it.each([
    [1, 2],
    [2, 2],
    [2.5, 2],
    [3, 3],
    [4, 3],
    [6, 3],
    [-1, 2],
    [Number.NaN, 2],
    ["3", 2],
    [undefined, 2],
  ])("level %s becomes %s", (level, expected) => {
    expect(clean(doc({ type: "heading", attrs: { level } }))).toEqual(doc({ type: "heading", attrs: { level: expected } }));
  });

  it("gives a heading without attrs the lowest level", () => {
    expect(clean(doc({ type: "heading", attrs: "x" }, { type: "heading" }))).toEqual(
      doc({ type: "heading", attrs: { level: 2 } }, { type: "heading", attrs: { level: 2 } }),
    );
  });
});

describe("sanitisePageBody rejects with an error code (AC-5)", () => {
  it.each([
    ["null", null],
    ["a string", "<p>hi</p>"],
    ["an array", [paragraph()]],
    ["a paragraph", paragraph()],
    ["a doc-like object without a type", { content: [] }],
  ])("%s is not a document", (_name, input) => {
    expect(rejection(input)).toEqual({ code: "page_body_not_a_document", path: [] });
  });

  it("rejects nesting deeper than the limit, and accepts it at the limit", () => {
    expect(rejection(nested(PAGE_BODY_MAX_DEPTH + 1))).toEqual({ code: "page_body_too_deep", path: [] });
    expect(clean(nested(PAGE_BODY_MAX_DEPTH))).toEqual(EMPTY_DOC);
  });

  it("allows the deepest valid body, a marked text in a quote, well inside the depth limit", () => {
    const deepest = doc({ type: "blockquote", content: [paragraph(text("q", [{ type: "bold" }]))] });
    expect(clean(deepest)).toEqual(deepest);
  });

  it("rejects a cyclic input as too deep instead of looping", () => {
    const node: Record<string, unknown> = { type: "paragraph" };
    node.content = [node];
    expect(rejection(doc(node))).toEqual({ code: "page_body_too_deep", path: [] });
  });

  it("rejects a body over the size limit once cleaned, and accepts one just under it", () => {
    const pages = (count: number) => doc(...Array.from({ length: count }, () => paragraph(text("पन्ना"))));
    const perParagraph = pageBodyByteLength(pages(2)) - pageBodyByteLength(pages(1));
    const fits = Math.floor((PAGE_BODY_MAX_BYTES - pageBodyByteLength(pages(0))) / perParagraph);
    expect(pageBodyByteLength(clean(pages(fits)))).toBeLessThanOrEqual(PAGE_BODY_MAX_BYTES);
    expect(rejection(pages(fits + 1))).toEqual({ code: "page_body_too_large", path: [] });
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:image/png;base64,AAAA"],
    ["another host", "https://evil.example/storage/v1/object/public/page-images/u/a.webp"],
    ["protocol-relative", "//abcdefghijkl.supabase.co/storage/v1/object/public/page-images/u/a.webp"],
    ["another bucket", `${options.storageUrl}/storage/v1/object/public/avatars/u/a.webp`],
    ["a path escape", imageUrl("u/../../avatars/a.webp")],
    ["a query", `${imageUrl("u/a.webp")}?download=1`],
    ["not a string", 42],
    ["missing", undefined],
  ])("rejects an image src that is %s", (_name, src) => {
    expect(rejection(doc(paragraph(text("x")), image({ ...goodImage, src })))).toEqual({
      code: "page_body_image_src_not_allowed",
      path: ["content", 1, "attrs", "src"],
    });
  });

  it("rejects an image with no attrs", () => {
    expect(rejection(doc({ type: "image" }))).toEqual({
      code: "page_body_image_src_not_allowed",
      path: ["content", 0, "attrs", "src"],
    });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", " \t 　"],
    ["only NUL", "\0"],
    ["not a string", ["alt"]],
  ])("rejects image alt text that is %s", (_name, alt) => {
    expect(rejection(doc(image({ src: goodImage.src, alt })))).toEqual({
      code: "page_body_image_alt_missing",
      path: ["content", 0, "attrs", "alt"],
    });
  });

  it("rejects alt text over the limit, counted in characters", () => {
    expect(clean(doc(image({ ...goodImage, alt: "😀".repeat(IMAGE_ALT_MAX_LENGTH) })))).toEqual(
      doc(image({ ...goodImage, alt: "😀".repeat(IMAGE_ALT_MAX_LENGTH) })),
    );
    expect(rejection(doc(image({ ...goodImage, alt: "क".repeat(IMAGE_ALT_MAX_LENGTH + 1) })))).toEqual({
      code: "page_body_image_alt_too_long",
      path: ["content", 0, "attrs", "alt"],
    });
  });

  it("reports the first problem when there are several", () => {
    const input = doc(image({ ...goodImage, alt: "" }), image({ ...goodImage, src: "javascript:x" }));
    expect(rejection(input)).toEqual({ code: "page_body_image_alt_missing", path: ["content", 0, "attrs", "alt"] });
  });

  it("uses only the listed error codes", () => {
    expect(PAGE_BODY_ERROR_CODES).toEqual([
      "page_body_not_a_document",
      "page_body_too_deep",
      "page_body_too_large",
      "page_body_image_src_not_allowed",
      "page_body_image_alt_missing",
      "page_body_image_alt_too_long",
    ]);
  });
});
