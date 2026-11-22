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

/** Like `textWithin`, and not only whitespace. */
export function nonBlankTextWithin(limit: TextLimit) {
  return textWithin(limit).refine((value) => value.trim() !== "", { message: "Must not be blank" });
}
