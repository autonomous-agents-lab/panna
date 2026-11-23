import type { TextLimit } from "@/config/books";

export type TitleCheck = { ok: true; title: string } | { ok: false; error: "empty" | "too_long" };

/**
 * A chapter or page title as the contract will take it: trimmed, not empty, and at most
 * `limit.max` characters, counted in code points as the contract and Postgres count them.
 */
export function validateTitle(raw: string, limit: Pick<TextLimit, "max">): TitleCheck {
  const title = raw.trim();
  const length = [...title].length;
  if (length === 0) return { ok: false, error: "empty" };
  if (length > limit.max) return { ok: false, error: "too_long" };
  return { ok: true, title };
}
