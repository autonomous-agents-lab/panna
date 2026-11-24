import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PageBody } from "@/contracts";

import { RichText } from "./RichText";

const render = (body: PageBody) => renderToStaticMarkup(<RichText body={body} />);

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
              { type: "hardBreak" },
              { type: "text", text: "after", marks: [{ type: "italic" }] },
            ],
          },
          { type: "paragraph" },
        ],
      }),
    ).toBe("<p>plain <strong>bold</strong> <em><strong>both</strong></em><br/><em>after</em></p><p></p>");
  });

  it("renders headings below the chapter heading, h3 and h4", () => {
    expect(
      render({
        type: "doc",
        content: [2, 3].map((level) => ({
          type: "heading" as const,
          attrs: { level: level as 2 | 3 },
          content: [{ type: "text" as const, text: `L${level}` }],
        })),
      }),
    ).toBe("<h3>L2</h3><h4>L3</h4>");
    expect(render({ type: "doc", content: [{ type: "heading", attrs: { level: 2 } }] })).toBe("<h3></h3>");
  });

  it("renders quotes of paragraphs", () => {
    expect(
      render({
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "said" }] },
              { type: "paragraph", content: [{ type: "text", text: "more" }] },
            ],
          },
        ],
      }),
    ).toBe("<blockquote><p>said</p><p>more</p></blockquote>");
  });

  it("renders images lazily with their alt text", () => {
    const src = "https://abcdefghijkl.supabase.co/storage/v1/object/public/page-images/u/rain.webp";
    expect(render({ type: "doc", content: [{ type: "image", attrs: { src, alt: "Rain on a window" } }] })).toBe(
      `<img src="${src}" alt="Rain on a window" loading="lazy" decoding="async"/>`,
    );
  });

  it("escapes text and attributes, so markup in a page is shown, never run", () => {
    const html = render({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: '<script>alert("x")</script><img onerror=x>' }] },
        { type: "image", attrs: { src: "https://x.test/a.png", alt: '"><script>x</script>' } },
      ],
    });
    expect(html).toBe(
      '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img onerror=x&gt;</p><img src="https://x.test/a.png" alt="&quot;&gt;&lt;script&gt;x&lt;/script&gt;" loading="lazy" decoding="async"/>',
    );
  });
});
