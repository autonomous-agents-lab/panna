import { describe, expect, it } from "vitest";

import { readRawCookie } from "./raw-cookie";

describe("readRawCookie", () => {
  it.each([
    ["locale=hi", "hi"],
    ["a=1; locale=%E0%A4%A; b=2", "%E0%A4%A"],
    ["  locale = en ; other=x", "en"],
    ["locale=; b=2", ""],
    ["locale=a=b", "a=b"],
    ["locale=first; locale=second", "first"],
  ])("reads %j as %j", (header, expected) => {
    expect(readRawCookie(header, "locale")).toBe(expected);
  });

  it.each([undefined, null, "", "other=hi", "mylocale=hi", "locale", "garbage;;;"])(
    "finds nothing in %j",
    (header) => {
      expect(readRawCookie(header, "locale")).toBeUndefined();
    },
  );
});
