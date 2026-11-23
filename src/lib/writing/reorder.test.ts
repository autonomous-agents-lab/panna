import { describe, expect, it } from "vitest";

import { nextPosition, reorder } from "./reorder";

describe("reorder", () => {
  it("gives contiguous positions 0..n-1 in the requested order", () => {
    const result = reorder(["a", "b", "c"], ["c", "a", "b"]);
    expect(result).toEqual({ ok: true, positions: new Map([["c", 0], ["a", 1], ["b", 2]]) });
  });

  it("keeps the same order when asked for it", () => {
    expect(reorder(["a", "b"], ["a", "b"])).toEqual({ ok: true, positions: new Map([["a", 0], ["b", 1]]) });
  });

  it.each([
    ["a foreign id in place of one", ["a", "x"]],
    ["a foreign id on top", ["a", "b", "x"]],
    ["a missing id", ["a"]],
    ["a repeated id", ["a", "a"]],
    ["a repeated id making up the count", ["a", "b", "b"]],
    ["nothing", []],
  ])("rejects %s", (_, requested) => {
    expect(reorder(["a", "b"], requested)).toEqual({ ok: false, error: "invalid_order" });
  });
});

describe("nextPosition", () => {
  it("is 0 for an empty list and one past the highest position otherwise", () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition([{ position: 0 }, { position: 4 }, { position: 2 }])).toBe(5);
  });
});
