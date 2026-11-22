import { z } from "zod";

import type { TextLimit } from "@/config/books";

/** A Postgres `timestamptz` as PostgREST and `to_jsonb` return it, e.g. `2026-11-23T10:00:00.123456+00:00`. */
export const timestampSchema = z.iso.datetime({ offset: true });

/** A string whose length in code points is within `limit`, the way Postgres `char_length` counts. */
export function textWithin({ min, max }: TextLimit) {
  return z.string().refine(
    (value) => {
      const length = [...value].length;
      return length >= min && length <= max;
    },
    { message: `Must be ${min} to ${max} characters` },
  );
}

/**
 * The characters `String.prototype.trim` strips, as a regex class body. The migrations' not-blank
 * checks and `public.trim_whitespace` use the same set (contracts.test.ts compares them), because
 * Postgres `btrim` strips only spaces and `[:space:]` depends on the database locale.
 */
export const WHITESPACE_CHARACTERS =
  "\\u0009-\\u000D\\u0020\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";

const NOT_ONLY_WHITESPACE = new RegExp(`[^${WHITESPACE_CHARACTERS}]`);

/** Like `textWithin`, and not only whitespace. */
export function nonBlankTextWithin(limit: TextLimit) {
  return textWithin(limit).refine((value) => NOT_ONLY_WHITESPACE.test(value), { message: "Must not be blank" });
}
