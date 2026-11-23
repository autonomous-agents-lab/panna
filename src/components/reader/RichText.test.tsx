import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RichTextDoc } from "@/contracts";

import { RichText } from "./RichText";

const render = (doc: RichTextDoc) => renderToStaticMarkup(<RichText doc={doc} />);

describe("RichText", () => {
  it("renders paragraphs, marks and line breaks as elements", () => {
    expect(
      render({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "plain " },
              { type: "text", text: "bold", marks: [{ type: "bold" }] },
              { type: "text", text: " " },
              { type: "text", text: "both", marks: [{ type: "bold" }, { type: "italic" }] },
              { type: "hard_break" },
              { type: "text", text: "after", marks: [{ type: "italic" }] },
            ],
          },
          { type: "paragraph" },
        ],
      }),
    ).toBe("<p>plain <strong>bold</strong> <em><strong>both</strong></em><br/><em>after</em></p><p></p>");
  });

  it("renders headings below the page title, h4 to h6", () => {
    expect(
      render({
        type: "doc",
        content: [2, 3, 4].map((level) => ({
          type: "heading" as const,
          attrs: { level: level as 2 | 3 | 4 },
          content: [{ type: "text" as const, text: `L${level}` }],
        })),
      }),
    ).toBe("<h4>L2</h4><h5>L3</h5><h6>L4</h6>");
    expect(render({ type: "doc", content: [{ type: "heading", attrs: { level: 2 } }] })).toBe("<h4></h4>");
  });

  it("renders quotes, nested ones too", () => {
    expect(
      render({
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "said" }] },
              { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "inner" }] }] },
            ],
          },
        ],
      }),
    ).toBe("<blockquote><p>said</p><blockquote><p>inner</p></blockquote></blockquote>");
  });

  it("escapes text, so markup in a page is shown, never run", () => {
    const html = render({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: '<script>alert("x")</script><img onerror=x>' }] }],
    });
    expect(html).toBe("<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img onerror=x&gt;</p>");
  });
});
