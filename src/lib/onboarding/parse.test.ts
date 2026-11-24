import { describe, expect, it } from "vitest";

import { parseOnboardingForm, readOnboardingValues } from "./parse";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

const VALID = { username: " Asha_K ", display_name: "  Asha Rao ", preferred_language: "hi" };

describe("parseOnboardingForm (AC-3)", () => {
  it("returns the RPC arguments trimmed and lowercased", () => {
    expect(parseOnboardingForm(form(VALID))).toEqual({
      ok: true,
      input: { p_username: "asha_k", p_display_name: "Asha Rao", p_preferred_language: "hi" },
      values: VALID,
    });
  });

  it("accepts a 50-character display name in Devanagari", () => {
    const parsed = parseOnboardingForm(form({ ...VALID, display_name: "आ".repeat(50) }));
    expect(parsed.ok).toBe(true);
  });
});

describe("parseOnboardingForm rejects a crafted request (AC-5)", () => {
  it.each([
    ["missing fields", {}, { username: "too_short", display_name: "required", preferred_language: "unsupported" }],
    ["a reserved name", { ...VALID, username: "Admin" }, { username: "reserved" }],
    ["the reserved route name write", { ...VALID, username: "WRITE" }, { username: "reserved" }],
    ["a name with a hyphen", { ...VALID, username: "asha-k" }, { username: "invalid_characters" }],
    ["a name starting with a digit", { ...VALID, username: "9asha" }, { username: "must_start_with_letter" }],
    ["a 31-character name", { ...VALID, username: "a".repeat(31) }, { username: "too_long" }],
    ["a blank display name", { ...VALID, display_name: "   " }, { display_name: "required" }],
    ["a 51-character display name", { ...VALID, display_name: "a".repeat(51) }, { display_name: "too_long" }],
    ["an unsupported language", { ...VALID, preferred_language: "fr" }, { preferred_language: "unsupported" }],
    ["a locale-looking language", { ...VALID, preferred_language: "HI" }, { preferred_language: "unsupported" }],
  ])("%s", (_case, entries, errors) => {
    expect(parseOnboardingForm(form(entries))).toEqual({ ok: false, errors, values: readOnboardingValues(form(entries)) });
  });

  it("never reads an id or user id from the form", () => {
    const parsed = parseOnboardingForm(form({ ...VALID, id: "someone-else", user_id: "someone-else" }));
    expect(parsed).toMatchObject({ ok: true, values: VALID });
    expect(parsed.ok && Object.keys(parsed.input).sort()).toEqual(["p_display_name", "p_preferred_language", "p_username"]);
  });
});

describe("readOnboardingValues", () => {
  it("reads a file posted as a field as empty", () => {
    const data = form({ display_name: "Asha" });
    data.append("username", new Blob(["asha"]), "asha");
    expect(readOnboardingValues(data)).toEqual({ username: "", display_name: "Asha", preferred_language: "" });
  });
});
