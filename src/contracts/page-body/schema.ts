import { z } from "zod";

import { HEADING_LEVELS, IMAGE_ALT_MAX_LENGTH, IMAGE_SRC_MAX_LENGTH, PAGE_BODY_MAX_BYTES } from "@/config/content";

import { nonBlankTextWithin } from "../fields";

/** Every node type a page body may contain (docs/content-format.md). */
export const PAGE_BODY_NODES = ["doc", "paragraph", "heading", "blockquote", "image", "text", "hardBreak"] as const;

/** Every mark a text node may carry. The order is the order marks nest in when rendered, outermost first. */
export const PAGE_BODY_MARKS = ["bold", "italic"] as const;

/** Size of a body as the limit counts it: UTF-8 bytes of its JSON.stringify form. */
export function pageBodyByteLength(body: unknown): number {
  return new TextEncoder().encode(JSON.stringify(body)).length;
}

const markSchema = z.strictObject({ type: z.enum(PAGE_BODY_MARKS) });

const textSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(markSchema).optional(),
});

const hardBreakSchema = z.strictObject({ type: z.literal("hardBreak") });

const inlineSchema = z.discriminatedUnion("type", [textSchema, hardBreakSchema]);

const paragraphSchema = z.strictObject({
  type: z.literal("paragraph"),
  content: z.array(inlineSchema).optional(),
});

const headingSchema = z.strictObject({
  type: z.literal("heading"),
  attrs: z.strictObject({ level: z.literal(HEADING_LEVELS) }),
  content: z.array(inlineSchema).optional(),
});

const blockquoteSchema = z.strictObject({
  type: z.literal("blockquote"),
  content: z.array(paragraphSchema).min(1),
});

/** The src must also pass isAllowedImageSrc, which needs the storage URL, so the sanitiser checks it. */
const imageSchema = z.strictObject({
  type: z.literal("image"),
  attrs: z.strictObject({
    src: z.string().max(IMAGE_SRC_MAX_LENGTH),
    alt: nonBlankTextWithin({ min: 1, max: IMAGE_ALT_MAX_LENGTH }),
  }),
});

const blockSchema = z.discriminatedUnion("type", [paragraphSchema, headingSchema, blockquoteSchema, imageSchema]);

/**
 * The shape of a stored page body: a ProseMirror/Tiptap JSON document limited to the allowlist.
 * Anything else fails to parse. Use sanitisePageBody on input from clients: it strips what this
 * schema would reject, applies the image URL rule and returns a body this schema accepts.
 */
export const pageBodySchema = z
  .strictObject({
    type: z.literal("doc"),
    content: z.array(blockSchema).min(1),
  })
  .refine((body) => pageBodyByteLength(body) <= PAGE_BODY_MAX_BYTES, {
    message: `Must be at most ${PAGE_BODY_MAX_BYTES} bytes`,
  });

export type PageBody = z.infer<typeof pageBodySchema>;
export type PageBlock = PageBody["content"][number];
export type PageInline = z.infer<typeof inlineSchema>;
export type PageParagraph = z.infer<typeof paragraphSchema>;
