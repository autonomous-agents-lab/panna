import type { PageBodyOptions } from "../image-src";
import type { PageBody } from "../schema";

export const options: PageBodyOptions = { storageUrl: "https://abcdefghijkl.supabase.co" };

export const imageUrl = (path: string) => `${options.storageUrl}/storage/v1/object/public/page-images/${path}`;

/** Every allowed node and mark, in Hindi and English, already in sanitised form. */
export const everyNode: PageBody = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "पहला पन्ना" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "आज " },
        { type: "text", text: "बारिश", marks: [{ type: "bold" }] },
        { type: "text", text: " हुई।" },
        { type: "hardBreak" },
        { type: "text", text: "Rain, at last", marks: [{ type: "italic" }] },
        { type: "text", text: " & tea", marks: [{ type: "bold" }, { type: "italic" }] },
      ],
    },
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "A smaller heading" }] },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "मन के हारे हार है" }] },
        { type: "paragraph", content: [{ type: "text", text: "Quoted, with a <tag>" }] },
      ],
    },
    { type: "image", attrs: { src: imageUrl("user-1/monsoon.webp"), alt: "खिड़की पर बारिश / rain on the window" } },
    { type: "paragraph" },
  ],
};

export const everyNodeHtml =
  "<h2>पहला पन्ना</h2>" +
  "<p>आज <strong>बारिश</strong> हुई।<br><em>Rain, at last</em><strong><em> &amp; tea</em></strong></p>" +
  "<h3>A smaller heading</h3>" +
  "<blockquote><p>मन के हारे हार है</p><p>Quoted, with a &lt;tag&gt;</p></blockquote>" +
  `<img src="${imageUrl("user-1/monsoon.webp")}" alt="खिड़की पर बारिश / rain on the window" loading="lazy" decoding="async">` +
  "<p></p>";
