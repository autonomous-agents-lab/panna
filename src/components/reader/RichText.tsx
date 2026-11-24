import { Fragment, type ReactNode } from "react";

import type { PageBlock, PageBody, PageInline } from "@/contracts";

// The book's title is h1 and a chapter h2, so body headings (levels 2 and 3) render as h3 and h4.
const HEADING_TAGS = { 2: "h3", 3: "h4" } as const;
const MARK_TAGS = { bold: "strong", italic: "em" } as const;

type PageText = Extract<PageInline, { type: "text" }>;

function renderText({ text, marks = [] }: PageText): ReactNode {
  return marks.reduce<ReactNode>((child, { type }) => {
    const Tag = MARK_TAGS[type];
    return <Tag>{child}</Tag>;
  }, text);
}

function renderInline(content: readonly PageInline[] = []): ReactNode[] {
  return content.map((node, index) =>
    node.type === "hardBreak" ? <br key={index} /> : <Fragment key={index}>{renderText(node)}</Fragment>,
  );
}

function renderBlock(block: PageBlock, index: number): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p key={index}>{renderInline(block.content)}</p>;
    case "heading": {
      const Tag = HEADING_TAGS[block.attrs.level];
      return <Tag key={index}>{renderInline(block.content)}</Tag>;
    }
    case "blockquote":
      return <blockquote key={index}>{block.content.map(renderBlock)}</blockquote>;
    case "image":
      // The source has already checked src against the page-images bucket (sanitisePageBody), and
      // the body gives no dimensions, which next/image needs.
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={index} src={block.attrs.src} alt={block.attrs.alt} loading="lazy" decoding="async" />;
  }
}

/**
 * A page body (docs/content-format.md) as elements. Text and attributes are React children and
 * props, so they are always escaped; there is no raw HTML.
 */
export function RichText({ body }: { body: PageBody }) {
  return <>{body.content.map(renderBlock)}</>;
}
