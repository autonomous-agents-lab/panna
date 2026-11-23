import { describe, expect, it } from "vitest";

import { TEXT_LIMITS } from "@/config/books";
import { PAGE_TITLE_LIMIT } from "@/config/writing";

import { validateTitle } from "./title";

describe("validateTitle (AC-4)", () => {
  it("trims a title within the limit", () => {
    expect(validateTitle("  Morning pages \n", PAGE_TITLE_LIMIT)).toEqual({ ok: true, title: "Morning pages" });
  });

  it.each(["", "   ", "\t\n", " 　"])("rejects %j as empty", (raw) => {
    expect(validateTitle(raw, TEXT_LIMITS.chapterTitle)).toEqual({ ok: false, error: "empty" });
  });

  it.each([
    ["Latin", "a"],
    ["Devanagari", "क"],
    ["astral", "𝒜"],
  ])("accepts exactly the maximum in %s characters, counted in code points", (_, character) => {
    const title = character.repeat(PAGE_TITLE_LIMIT.max);
    expect(validateTitle(title, PAGE_TITLE_LIMIT)).toEqual({ ok: true, title });
  });

  it.each([
    ["Latin", "a"],
    ["Devanagari", "क"],
    ["astral", "𝒜"],
  ])("rejects one %s character over the maximum", (_, character) => {
    expect(validateTitle(character.repeat(TEXT_LIMITS.chapterTitle.max + 1), TEXT_LIMITS.chapterTitle)).toEqual({
      ok: false,
      error: "too_long",
    });
  });

  it("counts only what is left after trimming", () => {
    expect(validateTitle(` ${"a".repeat(PAGE_TITLE_LIMIT.max)} `, PAGE_TITLE_LIMIT).ok).toBe(true);
  });
});
