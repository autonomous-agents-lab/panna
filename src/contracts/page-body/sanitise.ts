import { HEADING_LEVELS, IMAGE_ALT_MAX_LENGTH, PAGE_BODY_MAX_BYTES, PAGE_BODY_MAX_DEPTH } from "@/config/content";

import type { PageBodyErrorCode } from "./errors";
import { isAllowedImageSrc, type PageBodyOptions } from "./image-src";
import {
  PAGE_BODY_MARKS,
  pageBodyByteLength,
  pageBodySchema,
  type PageBlock,
  type PageBody,
  type PageInline,
  type PageParagraph,
} from "./schema";

/** Where in the input a rejected value is, e.g. `["content", 2, "attrs", "src"]`. */
export type PageBodyPath = (string | number)[];

export type SanitiseResult =
  | { ok: true; body: PageBody }
  | { ok: false; code: PageBodyErrorCode; path: PageBodyPath };

type Rejection = { code: PageBodyErrorCode; path: PageBodyPath };

interface Context {
  options: PageBodyOptions;
  /** The first rejection found; the walk carries on but its result is discarded. */
  rejection?: Rejection;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const children = (node: Record<string, unknown>): unknown[] => (Array.isArray(node.content) ? node.content : []);

/** Drops characters Postgres jsonb can't store: NUL and unpaired surrogates (replaced with U+FFFD). */
const storableText = (text: string) => text.toWellFormed().replaceAll("\0", "");

function reject(context: Context, code: PageBodyErrorCode, path: PageBodyPath): [] {
  context.rejection ??= { code, path };
  return [];
}

/** Whether objects and arrays nest deeper than `max`. Iterative, so hostile nesting can't overflow the stack. */
function nestsDeeperThan(root: object, max: number): boolean {
  const stack: [object, number][] = [[root, 1]];
  for (let item = stack.pop(); item; item = stack.pop()) {
    const [value, depth] = item;
    if (depth > max) return true;
    for (const child of Object.values(value)) {
      if (typeof child === "object" && child !== null) stack.push([child, depth + 1]);
    }
  }
  return false;
}

function sanitiseInline(node: unknown): PageInline[] {
  if (!isRecord(node)) return [];
  if (node.type === "hardBreak") return [{ type: "hardBreak" }];
  if (node.type !== "text" || typeof node.text !== "string") return [];
  const text = storableText(node.text);
  if (text === "") return [];
  const given = Array.isArray(node.marks) ? node.marks.filter(isRecord).map((mark) => mark.type) : [];
  const marks = PAGE_BODY_MARKS.filter((type) => given.includes(type)).map((type) => ({ type }));
  return [marks.length > 0 ? { type: "text", text, marks } : { type: "text", text }];
}

function withInlineContent<T extends object>(node: Record<string, unknown>, base: T): T & { content?: PageInline[] } {
  const content = children(node).flatMap(sanitiseInline);
  return content.length > 0 ? { ...base, content } : base;
}

const sanitiseParagraph = (node: Record<string, unknown>): PageParagraph =>
  withInlineContent(node, { type: "paragraph" as const });

/** Level 1 (and anything that isn't a number) becomes the lowest allowed level; 4 and up the highest. */
function headingLevel(attrs: unknown): (typeof HEADING_LEVELS)[number] {
  const level = isRecord(attrs) ? attrs.level : undefined;
  return typeof level === "number" && level >= HEADING_LEVELS[1] ? HEADING_LEVELS[1] : HEADING_LEVELS[0];
}

function sanitiseImage(node: Record<string, unknown>, path: PageBodyPath, context: Context): PageBlock[] {
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  const { src, alt } = attrs;
  if (typeof src !== "string" || !isAllowedImageSrc(src, context.options)) {
    return reject(context, "page_body_image_src_not_allowed", [...path, "attrs", "src"]);
  }
  const text = typeof alt === "string" ? storableText(alt) : "";
  if (text.trim() === "") return reject(context, "page_body_image_alt_missing", [...path, "attrs", "alt"]);
  if ([...text].length > IMAGE_ALT_MAX_LENGTH) {
    return reject(context, "page_body_image_alt_too_long", [...path, "attrs", "alt"]);
  }
  return [{ type: "image", attrs: { src, alt: text } }];
}

/** A block in its cleaned form, or nothing if it isn't allowed at the top level of a doc. */
function sanitiseBlock(node: unknown, path: PageBodyPath, context: Context): PageBlock[] {
  if (!isRecord(node)) return [];
  switch (node.type) {
    case "paragraph":
      return [sanitiseParagraph(node)];
    case "heading":
      return [withInlineContent(node, { type: "heading" as const, attrs: { level: headingLevel(node.attrs) } })];
    case "blockquote": {
      const content = children(node).flatMap((child) =>
        isRecord(child) && child.type === "paragraph" ? [sanitiseParagraph(child)] : [],
      );
      return content.length > 0 ? [{ type: "blockquote", content }] : [];
    }
    case "image":
      return sanitiseImage(node, path, context);
    default:
      return [];
  }
}

/**
 * Turns untrusted input into a page body that follows docs/content-format.md. Strips unknown or
 * misplaced nodes (with their content), unknown marks and attributes, and empty text; clamps
 * heading levels; rejects, with a code and the path of the problem, anything that isn't a doc,
 * nests too deeply, has an image that breaks the rules, or is too large once cleaned.
 */
export function sanitisePageBody(input: unknown, options: PageBodyOptions): SanitiseResult {
  if (!isRecord(input) || input.type !== "doc") return { ok: false, code: "page_body_not_a_document", path: [] };
  if (nestsDeeperThan(input, PAGE_BODY_MAX_DEPTH)) return { ok: false, code: "page_body_too_deep", path: [] };

  const context: Context = { options };
  const content = children(input).flatMap((child, index) => sanitiseBlock(child, ["content", index], context));
  if (context.rejection) return { ok: false, ...context.rejection };

  const body: PageBody = { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
  if (pageBodyByteLength(body) > PAGE_BODY_MAX_BYTES) return { ok: false, code: "page_body_too_large", path: [] };
  return { ok: true, body: pageBodySchema.parse(body) };
}
