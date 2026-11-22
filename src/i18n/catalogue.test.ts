import { describe, expect, it } from "vitest";

import { catalogues, compareCatalogues, endonymOf, translatorFor } from "./catalogue";
import { en } from "./messages/en";
import { hi } from "./messages/hi";

const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("compareCatalogues", () => {
  it("finds nothing when both catalogues have the same, non-empty keys", () => {
    expect(compareCatalogues({ a: "A", b: "B" }, { b: "ब", a: "अ" })).toEqual({ missing: [], extra: [], empty: [] });
  });

  it("reports a key missing from the other catalogue", () => {
    expect(compareCatalogues({ a: "A", b: "B" }, { a: "अ" }).missing).toEqual(["b"]);
  });

  it("reports a key only the other catalogue has", () => {
    expect(compareCatalogues({ a: "A" }, { a: "अ", c: "स" }).extra).toEqual(["c"]);
  });

  it("reports empty and whitespace-only values on either side, once each", () => {
    expect(compareCatalogues({ a: "", b: "B", c: " \n" }, { a: "", b: "\t", c: "स" }).empty).toEqual(["a", "b", "c"]);
    expect(compareCatalogues({ a: "A" }, { a: "अ", z: "" }).empty).toEqual(["z"]);
  });
});

describe("the English and Hindi catalogues", () => {
  it("have the same keys and no empty values", () => {
    expect(compareCatalogues(en, hi)).toEqual({ missing: [], extra: [], empty: [] });
  });

  it("use the same placeholders for every key", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(hi[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("are the catalogues served for each locale", () => {
    expect(catalogues).toEqual({ en, hi });
  });

  it("name each language in its own language", () => {
    expect(endonymOf("en")).toBe("English");
    expect(endonymOf("hi")).toBe("हिन्दी");
  });
});

describe("translatorFor", () => {
  it("translates with the given locale's catalogue", () => {
    expect(translatorFor("en")("localeSwitch.label")).toBe("Language");
    expect(translatorFor("hi")("shell.homeLink", { appName: "Kitaab" })).toBe("Kitaab, मुखपृष्ठ");
  });
});
