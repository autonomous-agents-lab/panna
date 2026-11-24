import { describe, expect, it, vi } from "vitest";

import { firstInvalidField, focusFirstInvalid } from "./focus";

describe("firstInvalidField (AC-8)", () => {
  it.each([
    [{}, null],
    [{ preferred_language: "unsupported" }, "preferred_language"],
    [{ display_name: "too_long", preferred_language: "unsupported" }, "display_name"],
    [{ preferred_language: "unsupported", display_name: "required", username: "taken" }, "username"],
  ] as const)("%j → %s, in form order", (errors, field) => {
    expect(firstInvalidField(errors)).toBe(field);
  });
});

describe("focusFirstInvalid (AC-8)", () => {
  const targets = () => ({
    username: { focus: vi.fn() },
    display_name: { focus: vi.fn() },
    preferred_language: { focus: vi.fn() },
  });

  it("focuses only the first invalid field", () => {
    const fields = targets();
    focusFirstInvalid({ display_name: "required", preferred_language: "unsupported" }, fields);
    expect(fields.display_name.focus).toHaveBeenCalledOnce();
    expect(fields.username.focus).not.toHaveBeenCalled();
    expect(fields.preferred_language.focus).not.toHaveBeenCalled();
  });

  it("does nothing without errors or without a mounted field", () => {
    const fields = targets();
    focusFirstInvalid({}, fields);
    focusFirstInvalid({ username: "taken" }, { ...fields, username: null });
    expect(Object.values(fields).every(({ focus }) => focus.mock.calls.length === 0)).toBe(true);
  });
});
