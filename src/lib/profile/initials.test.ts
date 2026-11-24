import { describe, expect, it } from "vitest";

import { initials } from "./initials";

describe("initials (AC-6)", () => {
  it.each([
    ["Asha", "A"],
    ["asha rao", "AR"],
    ["  Asha   K.  Rao ", "AR"],
    ["आशा", "आ"],
    ["आशा राव", "आरा"],
    ["श्री देवी", "श्रीदे"],
    ["क्षमा", "क्ष"],
    ["Ölaf Øster", "ÖØ"],
    ["😀 Smile", "😀S"],
    ["   ", ""],
  ])("%j → %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
