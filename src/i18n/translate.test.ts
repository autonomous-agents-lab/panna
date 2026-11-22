import { describe, expect, it } from "vitest";

import { catalogues } from "./catalogue";
import { createTranslator } from "./translate";

describe("createTranslator", () => {
  const t = createTranslator({ ...catalogues.en, "shell.homeLink": "{appName} home, {appName} {count} {missing}" });

  it("looks up a message", () => {
    expect(t("localeSwitch.label")).toBe("Language");
    expect(createTranslator(catalogues.hi)("localeSwitch.label")).toBe("भाषा");
  });

  it("fills every placeholder it has a value for and leaves the others", () => {
    expect(t("shell.homeLink", { appName: "Book", count: 3 })).toBe("Book home, Book 3 {missing}");
  });

  it("leaves placeholders alone when no values are given", () => {
    expect(t("shell.homeLink")).toBe("{appName} home, {appName} {count} {missing}");
  });

  it("does not read inherited properties as values", () => {
    expect(t("shell.homeLink", {})).toContain("{appName}");
    expect(createTranslator({ ...catalogues.en, "shell.homeLink": "{toString}" })("shell.homeLink", {})).toBe(
      "{toString}",
    );
  });
});
