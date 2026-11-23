import { Fragment, type ReactNode } from "react";

import type { RichTextBlock, RichTextDoc, RichTextInline, RichTextText } from "@/contracts";

// The book's title is h1, a chapter h2 and a page title h3, so content headings start at h4.
const HEADING_TAGS = { 2: "h4", 3: "h5", 4: "h6" } as const;
const MARK_TAGS = { bold: "strong", italic: "em" } as const;

function renderText({ text, marks = [] }: RichTextText): ReactNode {
  return marks.reduce<ReactNode>((child, { type }) => {
    const Tag = MARK_TAGS[type];
    return <Tag>{child}</Tag>;
  }, text);
}

function renderInline(content: readonly RichTextInline[] = []): ReactNode[] {
  return content.map((node, index) =>
    node.type === "hard_break" ? <br key={index} /> : <Fragment key={index}>{renderText(node)}</Fragment>,
  );
}

function renderBlock(block: RichTextBlock, index: number): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p key={index}>{renderInline(block.content)}</p>;
    case "heading": {
      const Tag = HEADING_TAGS[block.attrs.level];
      return <Tag key={index}>{renderInline(block.content)}</Tag>;
    }
    case "blockquote":
      return <blockquote key={index}>{block.content.map(renderBlock)}</blockquote>;
  }
}

/** A page's content as elements. Text is a React child, so it is always escaped; there is no raw HTML. */
export function RichText({ doc }: { doc: RichTextDoc }) {
  return <>{doc.content.map(renderBlock)}</>;
}
