import { describe, expect, it } from "vitest";

import { everyNode, everyNodeHtml, imageUrl, options } from "./__fixtures__/documents";
import { escapeHtml, renderPageBodyToHtml } from "./render";

const render = (body: unknown) => renderPageBodyToHtml(body, options);
const doc = (...content: unknown[]) => ({ type: "doc", content });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: { type: string }[]) => ({ type: "text", text: value, marks });

describe("renderPageBodyToHtml (AC-6)", () => {
  it("renders every node and mark, Hindi and English, to the expected HTML", () => {
    expect(render(everyNode)).toBe(everyNodeHtml);
  });

  it("keeps Devanagari text byte for byte", () => {
    const hindi = "क्षत्रिय ज्ञान श्री — ॐ, ड़ ढ़ ँ ं ः ़ ॅ ॉ";
    expect(render(doc(paragraph(text(hindi))))).toBe(`<p>${hindi}</p>`);
  });

  it("renders bold, italic and both, with strong outside em", () => {
    expect(render(doc(paragraph(text("b", [{ type: "bold" }]), text("i", [{ type: "italic" }]), text("bi", [{ type: "italic" }, { type: "bold" }]))))).toBe(
      "<p><strong>b</strong><em>i</em><strong><em>bi</em></strong></p>",
    );
  });

  it("renders empty paragraphs and headings as empty elements", () => {
    expect(render(doc({ type: "paragraph" }, { type: "heading", attrs: { level: 3 } }))).toBe("<p></p><h3></h3>");
  });

  it("escapes <, >, &, and both quotes in text and in alt text", () => {
    const nasty = `<b>"Tom" & 'Jerry'</b>`;
    expect(render(doc(paragraph(text(nasty)), { type: "image", attrs: { src: imageUrl("a.png"), alt: nasty } }))).toBe(
      "<p>&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;</p>" +
        `<img src="${imageUrl("a.png")}" alt="&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;" loading="lazy" decoding="async">`,
    );
  });

  it("has no wrapper element and sets no lang, which is the caller's job", () => {
    expect(render(doc(paragraph(text("x"))))).toBe("<p>x</p>");
  });
});

describe("renderPageBodyToHtml with hostile bodies written straight to the table (AC-5)", () => {
  it("emits only allowed elements and attributes from an unsanitised body", () => {
    const hostile = {
      type: "doc",
      content: [
        { type: "script", content: [text("alert(1)")] },
        { type: "paragraph", attrs: { onclick: "alert(1)", style: "x" }, content: [text("<img src=x onerror=alert(1)>")] },
        { type: "heading", attrs: { level: 1, onmouseover: "alert(1)" }, content: [text("h", [{ type: "link" }])] },
        { type: "blockquote", content: [{ type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } }, paragraph(text("q"))] },
        { type: "rawHtml", html: "<script>alert(1)</script>" },
      ],
    };
    const html = render(hostile);
    expect(html).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p><h2>h</h2><blockquote><p>q</p></blockquote>");
    expect(html.match(/<[^>]*>/g)).toEqual(["<p>", "</p>", "<h2>", "</h2>", "<blockquote>", "<p>", "</p>", "</blockquote>"]);
  });

  it.each([
    ["an off-bucket image", doc({ type: "image", attrs: { src: "https://evil.example/a.png", alt: "x" } })],
    ["an image without alt", doc({ type: "image", attrs: { src: imageUrl("a.png") } })],
    ["something that isn't a doc", { type: "script", content: [] }],
    ["null", null],
  ])("renders %s as an empty string", (_name, body) => {
    expect(render(body)).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes every character that is special in content or quoted attributes, & first", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    expect(escapeHtml("हिन्दी plain")).toBe("हिन्दी plain");
  });
});
