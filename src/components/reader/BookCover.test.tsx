import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReaderBookInfo, ReaderWriter } from "@/contracts";
import { translatorFor } from "@/i18n";

import { BookCover } from "./BookCover";

const writer: ReaderWriter = { username: "asha_k", display_name: "Asha", bio: "Writes at night.", photo_url: null };
const book: ReaderBookInfo = {
  id: "0f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
  title: "Night Notes",
  subtitle: "Small pages",
  cover_style: "linen",
  font: "caveat",
  default_language: "en",
};

describe("BookCover", () => {
  it("shows the title, subtitle, byline and bio, with style and font hooks", () => {
    const html = renderToStaticMarkup(<BookCover writer={writer} book={book} t={translatorFor("en")} />);
    expect(html).toMatch(/^<header class="[^"]*" data-cover-style="linen" data-font="caveat">/);
    expect(html).toMatch(/<h1 class="[^"]*">Night Notes<\/h1>/);
    expect(html).toMatch(/<p class="[^"]*">Small pages<\/p>/);
    expect(html).toMatch(/<p class="[^"]*">by Asha<\/p>/);
    expect(html).toMatch(/<p class="[^"]*">Writes at night.<\/p>/);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a ");
  });

  it("leaves out an empty subtitle and bio, and bylines in Hindi", () => {
    const html = renderToStaticMarkup(
      <BookCover writer={{ ...writer, bio: null }} book={{ ...book, subtitle: null }} t={translatorFor("hi")} />,
    );
    expect(html).toMatch(/<h1 class="[^"]*">Night Notes<\/h1><div/);
    expect(html).toMatch(/<div><p class="[^"]*">लेखक: Asha<\/p><\/div>/);
  });

  it("links the title to the whole book when given a link", () => {
    const html = renderToStaticMarkup(<BookCover writer={writer} book={book} t={translatorFor("en")} bookHref="/asha_k" />);
    expect(html).toMatch(/<h1 class="[^"]*"><a href="\/asha_k">Night Notes<\/a><\/h1>/);
  });

  it("shows the writer's photo with a translated description when there is one", () => {
    const html = renderToStaticMarkup(
      <BookCover writer={{ ...writer, photo_url: "https://example.org/asha.png" }} book={book} t={translatorFor("en")} />,
    );
    expect(html).toMatch(/<img alt="Photo of Asha"[^>]*width="64" height="64"/);
    expect(html).toContain("example.org%2Fasha.png");
  });
});
