import { describe, expect, it } from "vitest";

import { renderRootCss, toCssVariableName, toCssVariables } from "./css-variables";

describe("toCssVariableName", () => {
  it.each([
    ["color.paper", "--color-paper"],
    ["color.paperAged", "--color-paper-aged"],
    ["space.4", "--space-4"],
    ["focus.ringWidth", "--focus-ring-width"],
    ["a.bC.dEF", "--a-b-c-d-e-f"],
  ])("%s → %s", (path, name) => {
    expect(toCssVariableName(path)).toBe(name);
  });
});

describe("toCssVariables", () => {
  it("flattens nested groups and numeric keys", () => {
    expect(
      toCssVariables({
        top: "1",
        group: { camelCase: "2", 12: "3", deeper: { leaf: "4" } },
      }),
    ).toEqual({
      "--top": "1",
      "--group-camel-case": "2",
      "--group-12": "3",
      "--group-deeper-leaf": "4",
    });
  });

  it("returns nothing for an empty tree", () => {
    expect(toCssVariables({})).toEqual({});
  });
});

describe("renderRootCss", () => {
  it("renders one declaration per token inside :root", () => {
    expect(renderRootCss({ color: { ink: "black" }, font: { serif: '"A B", serif' } })).toBe(
      ':root{--color-ink:black;--font-serif:"A B", serif;}',
    );
  });

  it("rejects values that could close the inline <style> element", () => {
    expect(() => renderRootCss({ color: { ink: "red}</style><script>" } })).toThrow(/</);
  });
});
