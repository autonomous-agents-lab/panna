import type { PageBodyOptions } from "./image-src";
import { sanitisePageBody } from "./sanitise";
import type { PageBlock, PageInline } from "./schema";

/** Escapes text for use in HTML element content and double- or single-quoted attribute values. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(node: PageInline): string {
  if (node.type === "hardBreak") return "<br>";
  const marks = (node.marks ?? []).map((mark) => mark.type);
  const italic = marks.includes("italic") ? `<em>${escapeHtml(node.text)}</em>` : escapeHtml(node.text);
  return marks.includes("bold") ? `<strong>${italic}</strong>` : italic;
}

const renderInlines = (content: PageInline[] | undefined) => (content ?? []).map(renderInline).join("");

function renderBlock(node: PageBlock): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${renderInlines(node.content)}</p>`;
    case "heading":
      return `<h${node.attrs.level}>${renderInlines(node.content)}</h${node.attrs.level}>`;
    case "blockquote":
      return `<blockquote>${node.content.map(renderBlock).join("")}</blockquote>`;
    case "image":
      return `<img src="${escapeHtml(node.attrs.src)}" alt="${escapeHtml(node.attrs.alt)}" loading="lazy" decoding="async">`;
  }
}

/**
 * Renders a page body to an HTML string with no wrapper element; the caller sets `lang` from the
 * page's language. The body is treated as untrusted (it may have been written straight to the
 * table), so it is sanitised first, and a body the sanitiser rejects renders as an empty string.
 */
export function renderPageBodyToHtml(body: unknown, options: PageBodyOptions): string {
  const result = sanitisePageBody(body, options);
  return result.ok ? result.body.content.map(renderBlock).join("") : "";
}
