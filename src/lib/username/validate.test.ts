import { describe, expect, it } from "vitest";

import { RESERVED_USERNAMES } from "@/config/usernames";

import { normalizeUsername, validateUsername } from "./validate";

const now = new Date("2026-11-23T12:00:00Z");

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Asha_K ")).toBe("asha_k");
  });
});

describe("validateUsername", () => {
  it.each([
    ["ab", "too_short"],
    ["  ab  ", "too_short"],
    ["", "too_short"],
    ["a".repeat(31), "too_long"],
    ["asha k", "invalid_characters"],
    ["asha-k", "invalid_characters"],
    ["asha.k", "invalid_characters"],
    ["आशाजी", "invalid_characters"],
    ["asha!", "invalid_characters"],
    ["\u{212a}sha", "invalid_characters"],
    ["1asha", "must_start_with_letter"],
    ["_asha", "must_start_with_letter"],
    ["admin", "reserved"],
    ["Admin", "reserved"],
    ["settings", "reserved"],
  ] as const)("rejects %j with %s", (raw, code) => {
    expect(validateUsername(raw, { now })).toEqual({ ok: false, code });
  });

  it.each([
    ["abc", "abc"],
    ["a".repeat(30), "a".repeat(30)],
    ["Asha", "asha"],
    ["  asha_k9 ", "asha_k9"],
  ])("accepts %j as %j", (raw, username) => {
    expect(validateUsername(raw, { now })).toEqual({ ok: true, username });
  });

  it("counts characters as code points, so two emoji are too short rather than four units", () => {
    expect(validateUsername("😀😀", { now })).toEqual({ ok: false, code: "too_short" });
  });

  it("uses the configured reserved list by default and accepts a custom one", () => {
    expect(RESERVED_USERNAMES).toContain("admin");
    expect(validateUsername("admin")).toEqual({ ok: false, code: "reserved" });
    expect(validateUsername("admin", { reserved: [] })).toEqual({ ok: true, username: "admin" });
    expect(validateUsername("asha", { reserved: ["asha"] })).toEqual({ ok: false, code: "reserved" });
  });

  it("rejects a name held in username history until it becomes reusable", () => {
    const future = new Date("2026-12-01T00:00:00Z");
    const past = new Date("2026-11-01T00:00:00Z");
    expect(validateUsername("asha", { heldUntil: future, now })).toEqual({ ok: false, code: "held" });
    expect(validateUsername("asha", { heldUntil: past, now })).toEqual({ ok: true, username: "asha" });
    expect(validateUsername("asha", { heldUntil: now, now })).toEqual({ ok: true, username: "asha" });
    expect(validateUsername("asha", { heldUntil: null, now })).toEqual({ ok: true, username: "asha" });
  });

  it("compares a hold with the current time by default", () => {
    const farFuture = new Date("2999-01-01T00:00:00Z");
    expect(validateUsername("asha", { heldUntil: farFuture })).toEqual({ ok: false, code: "held" });
  });

  it("checks rules in order: length before characters before the first letter", () => {
    expect(validateUsername("1-", { now })).toEqual({ ok: false, code: "too_short" });
    expect(validateUsername("1-a", { now })).toEqual({ ok: false, code: "invalid_characters" });
    expect(validateUsername("admin", { heldUntil: new Date("2999-01-01T00:00:00Z"), now })).toEqual({
      ok: false,
      code: "reserved",
    });
  });
});
