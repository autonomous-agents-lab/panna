import { describe, expect, it } from "vitest";

import type { PublicBook } from "@/contracts/public-book";

import { bookJsonLd } from "./structured-data";

const BOOK: PublicBook = {
  username: "asha",
  display_name: "Asha Rao",
  bio: null,
  avatar_path: null,
  book: { title: "Asha Rao", subtitle: null, default_language: "hi" },
};

describe("bookJsonLd (AC-6)", () => {
  it("describes the book and its writer", () => {
    expect(JSON.parse(bookJsonLd(BOOK, "https://example.org/asha"))).toEqual({
      "@context": "https://schema.org",
      "@type": "Book",
      name: "Asha Rao",
      inLanguage: "hi",
      url: "https://example.org/asha",
      author: { "@type": "Person", name: "Asha Rao" },
    });
  });

  it("adds the subtitle and bio when there are any", () => {
    const data = JSON.parse(bookJsonLd({ ...BOOK, bio: "Poems", book: { ...BOOK.book, subtitle: "Notes" } }, "/asha"));
    expect(data).toMatchObject({ alternativeHeadline: "Notes", author: { description: "Poems" } });
  });

  it("can't close the script element it is embedded in", () => {
    const json = bookJsonLd({ ...BOOK, book: { ...BOOK.book, title: "</script><script>alert(1)</script>" } }, "/asha");
    expect(json).not.toContain("<");
    expect(JSON.parse(json).name).toBe("</script><script>alert(1)</script>");
  });
});
