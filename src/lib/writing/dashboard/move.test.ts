import { describe, expect, it } from "vitest";

import { focusTargetAfterMove, moveId, pageOrderAfterMove } from "./move";

describe("moveId (AC-3)", () => {
  const ids = ["a", "b", "c"];

  it("swaps an item with the one above it", () => {
    expect(moveId(ids, "b", "up")).toEqual({ ids: ["b", "a", "c"], position: 1, count: 3 });
  });

  it("swaps an item with the one below it", () => {
    expect(moveId(ids, "b", "down")).toEqual({ ids: ["a", "c", "b"], position: 3, count: 3 });
  });

  it("leaves the input untouched", () => {
    moveId(ids, "a", "down");
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it.each([
    ["the first item up", "a", "up"],
    ["the last item down", "c", "down"],
    ["an unknown id up", "x", "up"],
    ["an unknown id down", "x", "down"],
  ] as const)("refuses to move %s", (_, id, direction) => {
    expect(moveId(ids, id, direction)).toBeNull();
  });
});

describe("pageOrderAfterMove (AC-3)", () => {
  const pages = [
    { id: "p1", status: "draft" },
    { id: "x1", status: "archived" },
    { id: "p2", status: "published" },
    { id: "x2", status: "archived" },
    { id: "p3", status: "draft" },
  ] as const;

  it("swaps the page with its listed neighbour and leaves archived pages in their slots", () => {
    expect(pageOrderAfterMove(pages, "p3", "up")).toEqual({ ids: ["p1", "x1", "p3", "x2", "p2"], position: 2, count: 3 });
    expect(pageOrderAfterMove(pages, "p1", "down")).toEqual({ ids: ["p2", "x1", "p1", "x2", "p3"], position: 2, count: 3 });
  });

  it("skips over archived pages, which aren't listed among the chapter's pages", () => {
    expect(pageOrderAfterMove(pages, "p2", "up")?.ids).toEqual(["p2", "x1", "p1", "x2", "p3"]);
  });

  it.each([
    ["an archived page", "x1", "up"],
    ["the first listed page up", "p1", "up"],
    ["the last listed page down", "p3", "down"],
    ["an unknown page", "zz", "down"],
  ] as const)("refuses to move %s", (_, id, direction) => {
    expect(pageOrderAfterMove(pages, id, direction)).toBeNull();
  });
});

describe("focusTargetAfterMove (AC-5)", () => {
  it("keeps focus on the pressed button while the item can move further that way", () => {
    expect(focusTargetAfterMove("up", 2, 3)).toBe("up");
    expect(focusTargetAfterMove("down", 2, 3)).toBe("down");
  });

  it("moves focus to the other button once the item reaches that end", () => {
    expect(focusTargetAfterMove("up", 1, 3)).toBe("down");
    expect(focusTargetAfterMove("down", 3, 3)).toBe("up");
  });
});
