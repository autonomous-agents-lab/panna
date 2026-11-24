import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderPage as ReaderPageData } from "@/contracts";
import { translatorFor } from "@/i18n";

import { ReaderPage } from "./ReaderPage";

const page: ReaderPageData = {
  id: "2f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
  language: "hi",
  body: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "पहला पन्ना" }] },
      { type: "paragraph", content: [{ type: "text", text: "नमस्ते" }] },
    ],
  },
  // Late on the 9th in UTC, already the 10th in India: the date shown must not depend on the server.
  published_at: "2026-11-09T22:00:00+00:00",
};

describe("ReaderPage", () => {
  it("is an article in the page's language, with its text and publish date", () => {
    const html = renderToStaticMarkup(<ReaderPage page={page} locale="en" t={translatorFor("en")} />);
    expect(html).toMatch(/^<article lang="hi" class="[^"]*"><h3>पहला पन्ना<\/h3><p>नमस्ते<\/p>/);
    expect(html).toContain(
      '<footer lang="en" class="',
    );
    expect(html).toContain('<time dateTime="2026-11-09T22:00:00+00:00">Published on November 9, 2026</time>');
  });

  it("formats the date in the UI's language, and adds no heading of its own", () => {
    const body = { type: "doc" as const, content: [{ type: "paragraph" as const }] };
    const html = renderToStaticMarkup(
      <ReaderPage page={{ ...page, body, language: "en" }} locale="hi" t={translatorFor("hi")} />,
    );
    expect(html).toMatch(/^<article lang="en" class="[^"]*"><p>/);
    expect(html).not.toContain("<h3");
    expect(html).toContain('<footer lang="hi"');
    expect(html).toContain("9 नवंबर 2026 को प्रकाशित");
  });
});
