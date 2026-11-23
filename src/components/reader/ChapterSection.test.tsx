import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderPage } from "@/contracts";
import { translatorFor } from "@/i18n";

import { ChapterSection } from "./ChapterSection";

const page = (id: string, text: string, language: "hi" | "en"): ReaderPage => ({
  id,
  title: null,
  language,
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  published_at: "2026-11-10T09:00:00+00:00",
});

describe("ChapterSection", () => {
  it("is a section named by its chapter heading, with its pages in the order given", () => {
    const chapterId = "1f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20";
    const html = renderToStaticMarkup(
      <ChapterSection
        chapter={{ id: chapterId, title: "Rain" }}
        pages={[page("a", "first", "hi"), page("b", "second", "en")]}
        locale="en"
        t={translatorFor("en")}
      />,
    );
    expect(html).toMatch(
      new RegExp(`^<section class="[^"]*" aria-labelledby="chapter-${chapterId}"><h2 id="chapter-${chapterId}" class="[^"]*">Rain</h2>`),
    );
    expect(html.indexOf('<article lang="hi"')).toBeLessThan(html.indexOf('<article lang="en"'));
    expect(html.indexOf("first")).toBeLessThan(html.indexOf("second"));
  });
});
