import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HEADING_LEVELS,
  IMAGE_ALT_MAX_LENGTH,
  IMAGE_SRC_MAX_LENGTH,
  PAGE_BODY_DB_MAX_BYTES,
  PAGE_BODY_MAX_BYTES,
  PAGE_BODY_MAX_DEPTH,
  PAGE_IMAGES_BUCKET,
} from "@/config/content";

import { options } from "./__fixtures__/documents";
import { PAGE_BODY_ERROR_CODES } from "./errors";
import { renderPageBodyToHtml } from "./render";
import { sanitisePageBody } from "./sanitise";
import { PAGE_BODY_MARKS, PAGE_BODY_NODES, pageBodySchema } from "./schema";

const doc = readFileSync(join(import.meta.dirname, "..", "..", "..", "docs", "content-format.md"), "utf8");
const examples = [...doc.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]!) as unknown);
const DEVANAGARI = /[ऀ-ॿ]/;

describe("docs/content-format.md (AC-8)", () => {
  it.each(PAGE_BODY_NODES)("lists the %s node", (node) => {
    expect(doc).toMatch(new RegExp(`^\\| \`${node}\`\\s*\\|`, "m"));
  });

  it.each(PAGE_BODY_MARKS)("lists the %s mark", (mark) => {
    expect(doc).toMatch(new RegExp(`^\\| \`${mark}\`\\s*\\|`, "m"));
  });

  it("lists the attributes and heading levels", () => {
    for (const attribute of ["level", "src", "alt", "marks"]) expect(doc).toContain(`\`${attribute}\``);
    expect(doc).toContain(`\`${HEADING_LEVELS[0]}\` or \`${HEADING_LEVELS[1]}\``);
  });

  it("states the image URL rule and the bucket", () => {
    expect(doc).toContain(`/storage/v1/object/public/${PAGE_IMAGES_BUCKET}/<path>`);
    expect(doc).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(doc).toMatch(/Same origin/);
    expect(doc).toMatch(/No credentials, query string or fragment/);
  });

  it("states every limit as configured", () => {
    for (const limit of [PAGE_BODY_MAX_BYTES, PAGE_BODY_DB_MAX_BYTES, PAGE_BODY_MAX_DEPTH, IMAGE_ALT_MAX_LENGTH, IMAGE_SRC_MAX_LENGTH]) {
      expect(doc).toContain(String(limit));
    }
  });

  it.each(PAGE_BODY_ERROR_CODES)("lists the %s error code", (code) => {
    expect(doc).toContain(`\`${code}\``);
  });

  it("has one Hindi and one English example", () => {
    expect(examples).toHaveLength(2);
    const texts = examples.map((example) => JSON.stringify(example));
    expect(texts.filter((text) => DEVANAGARI.test(text))).toHaveLength(1);
    expect(texts.filter((text) => !DEVANAGARI.test(text))).toHaveLength(1);
  });

  it.each(examples.map((example, index) => [index, example] as const))(
    "example %i is a valid body the sanitiser leaves unchanged and the renderer renders",
    (_index, example) => {
      expect(pageBodySchema.parse(example)).toEqual(example);
      expect(sanitisePageBody(example, options)).toEqual({ ok: true, body: example });
      expect(renderPageBodyToHtml(example, options)).toMatch(/^<h2>.*<img [^>]*alt="[^"]+"[^>]*>$/);
    },
  );

  it("uses every node and mark across its examples", () => {
    const used = JSON.stringify(examples);
    for (const type of [...PAGE_BODY_NODES, ...PAGE_BODY_MARKS]) expect(used).toContain(`"type":"${type}"`);
  });
});
