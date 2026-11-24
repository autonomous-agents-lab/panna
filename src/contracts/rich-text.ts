import { z } from "zod";

import { RICH_TEXT_HEADING_LEVELS, RICH_TEXT_MARKS } from "@/config/pages";

// A page's content: a small structured document, not HTML. Every object is strict and every
// node type and mark is listed, so anything else (a script, a link, an attribute) fails to
// parse. That whitelist is the sanitising; readers render the text as escaped React children.
// The writing editor (BOOK-19) saves exactly this shape. Adding a node is a contract change.

export type RichTextMarkType = (typeof RICH_TEXT_MARKS)[number];
export type RichTextHeadingLevel = (typeof RICH_TEXT_HEADING_LEVELS)[number];

export interface RichTextMark {
  type: RichTextMarkType;
}

export interface RichTextText {
  type: "text";
  text: string;
  marks?: RichTextMark[];
}

export interface RichTextHardBreak {
  type: "hard_break";
}

export type RichTextInline = RichTextText | RichTextHardBreak;

export interface RichTextParagraph {
  type: "paragraph";
  content?: RichTextInline[];
}

export interface RichTextHeading {
  type: "heading";
  attrs: { level: RichTextHeadingLevel };
  content?: RichTextInline[];
}

export interface RichTextBlockquote {
  type: "blockquote";
  content: RichTextBlock[];
}

export type RichTextBlock = RichTextParagraph | RichTextHeading | RichTextBlockquote;

export interface RichTextDoc {
  type: "doc";
  content: RichTextBlock[];
}

const markSchema = z.strictObject({ type: z.enum(RICH_TEXT_MARKS) });

const inlineSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), text: z.string().min(1), marks: z.array(markSchema).optional() }),
  z.strictObject({ type: z.literal("hard_break") }),
]);

export const richTextBlockSchema: z.ZodType<RichTextBlock> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("paragraph"), content: z.array(inlineSchema).optional() }),
    z.strictObject({
      type: z.literal("heading"),
      attrs: z.strictObject({ level: z.literal(RICH_TEXT_HEADING_LEVELS) }),
      content: z.array(inlineSchema).optional(),
    }),
    z.strictObject({ type: z.literal("blockquote"), content: z.array(richTextBlockSchema).min(1) }),
  ]),
);

export const richTextDocSchema = z.strictObject({
  type: z.literal("doc"),
  content: z.array(richTextBlockSchema),
}) satisfies z.ZodType<RichTextDoc>;

function inlineText(content: readonly RichTextInline[] = []): string {
  return content.map((node) => (node.type === "text" ? node.text : "\n")).join("");
}

function blockText(block: RichTextBlock): string {
  return block.type === "blockquote" ? blocksText(block.content) : inlineText(block.content);
}

function blocksText(blocks: readonly RichTextBlock[]): string {
  return blocks.map(blockText).join("\n\n");
}

/** The document's text without formatting: blocks separated by a blank line, line breaks kept. */
export function richTextPlainText(doc: RichTextDoc): string {
  return blocksText(doc.content);
}
