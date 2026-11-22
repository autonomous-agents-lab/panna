import { describe, expect, it } from "vitest";

import {
  CONTENT_LANGUAGES,
  COVER_STYLES,
  DEFAULT_CONTENT_LANGUAGE,
  DEFAULT_COVER_STYLE,
  DEFAULT_FONT,
  FONT_IDS,
  TEXT_LIMITS,
} from "./books";
import * as config from "./index";

describe("book config", () => {
  it.each([
    ["COVER_STYLES", COVER_STYLES],
    ["FONT_IDS", FONT_IDS],
    ["CONTENT_LANGUAGES", CONTENT_LANGUAGES],
  ])("%s has no duplicates and only lowercase ids", (_, list) => {
    expect(new Set(list).size).toBe(list.length);
    for (const id of list) expect(id).toMatch(/^[a-z][a-z_]*$/);
  });

  it("defaults are members of their lists", () => {
    expect(COVER_STYLES).toContain(DEFAULT_COVER_STYLE);
    expect(FONT_IDS).toContain(DEFAULT_FONT);
    expect(CONTENT_LANGUAGES).toContain(DEFAULT_CONTENT_LANGUAGE);
  });

  it("text limits are sane ranges", () => {
    for (const { min, max } of Object.values(TEXT_LIMITS)) {
      expect(Number.isInteger(min) && Number.isInteger(max)).toBe(true);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeGreaterThan(min);
    }
  });

  it("is exported from src/config", () => {
    expect(config.COVER_STYLES).toBe(COVER_STYLES);
    expect(config.TEXT_LIMITS).toBe(TEXT_LIMITS);
  });
});
