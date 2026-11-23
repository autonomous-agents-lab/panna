import { describe, expect, it } from "vitest";

import { writingRoutesEnabled } from "./gate";

describe("writingRoutesEnabled", () => {
  it("serves the writing routes on the stand-in store only when stand-in writing is on", () => {
    expect(writingRoutesEnabled({ writingDataSource: "stand-in", standInWriting: true })).toBe(true);
    expect(writingRoutesEnabled({ writingDataSource: "stand-in", standInWriting: false })).toBe(false);
  });
});
