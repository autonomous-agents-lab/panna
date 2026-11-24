import { describe, expect, it } from "vitest";

import { isDuplicateProfileError } from "./db-error";

describe("isDuplicateProfileError", () => {
  it("recognises a second profile for the same user", () => {
    expect(
      isDuplicateProfileError({ code: "23505", message: 'duplicate key value violates unique constraint "profiles_pkey"' }),
    ).toBe(true);
  });

  it.each([
    ["no error", null],
    ["a taken username", { code: "23505", message: 'violates unique constraint "profiles_username_lower_key"' }],
    ["a duplicate without a message", { code: "23505" }],
    ["the constraint name under another code", { code: "23514", message: '"profiles_pkey"' }],
  ])("is false for %s", (_case, error) => {
    expect(isDuplicateProfileError(error)).toBe(false);
  });
});
