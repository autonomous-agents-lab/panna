import { describe, expect, it } from "vitest";

import { catalogues } from "@/i18n/catalogue";

import { elements, noop, render, tFor } from "./__fixtures__/render";
import { EmptyState } from "./EmptyState";

describe("EmptyState (AC-1)", () => {
  it.each(["en", "hi"] as const)("in %s, says the book has no pages yet and offers to write the first one", (locale) => {
    const t = catalogues[locale];
    const html = render(locale, <EmptyState t={tFor(locale)} startWriting={noop} />);

    const [section] = elements(html, "section");
    const [heading] = elements(html, "h2");
    expect(heading).toMatchObject({ text: t["write.empty.heading"], id: section?.["aria-labelledby"] });
    expect(html).toContain(`<p>${t["write.empty.body"]}</p>`);
    const [button] = elements(html, "button");
    expect(button).toMatchObject({ type: "submit", text: t["write.empty.start"] });
    expect(button).not.toHaveProperty("aria-label");
    expect(elements(html, "form")).toHaveLength(1);
  });
});
