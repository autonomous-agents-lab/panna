import { describe, expect, it } from "vitest";

import { usernameErrorFromDb } from "./db-error";

describe("usernameErrorFromDb", () => {
  it("maps a duplicate on the case-insensitive username index to taken", () => {
    expect(
      usernameErrorFromDb({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_username_lower_key"',
      }),
    ).toBe("taken");
  });

  it("maps the function's held and reserved exceptions", () => {
    expect(usernameErrorFromDb({ code: "P0001", message: "username_held" })).toBe("held");
    expect(usernameErrorFromDb({ code: "P0001", message: "username_reserved" })).toBe("reserved");
  });

  it.each([
    ["no error", null],
    ["undefined", undefined],
    ["a duplicate profile for the same user", { code: "23505", message: 'violates unique constraint "profiles_pkey"' }],
    ["a duplicate without a message", { code: "23505" }],
    ["another raised exception", { code: "P0001", message: "something_else" }],
    ["the index name under another code", { code: "23514", message: "profiles_username_lower_key" }],
    ["a permission error", { code: "42501", message: "not_authenticated" }],
  ])("returns null for %s", (_, error) => {
    expect(usernameErrorFromDb(error)).toBeNull();
  });
});
