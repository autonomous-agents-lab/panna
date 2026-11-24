import type { PublicBook } from "@/contracts/public-book";

/**
 * The book's schema.org JSON-LD, ready to put inside a `<script type="application/ld+json">`.
 * `<` is escaped, so a title or bio can never close the script element.
 */
export function bookJsonLd(book: PublicBook, url: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.book.title,
    ...(book.book.subtitle ? { alternativeHeadline: book.book.subtitle } : {}),
    inLanguage: book.book.default_language,
    url,
    author: {
      "@type": "Person",
      name: book.display_name,
      ...(book.bio ? { description: book.bio } : {}),
    },
  };
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
