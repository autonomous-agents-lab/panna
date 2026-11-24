// Fixed product sets for chapters and pages, not env. The chapters/pages migration (BOOK-19)
// must mirror these in its check constraints, as src/config/books.ts is mirrored for books.

import type { TextLimit } from "./books";

/** A page is a draft until its writer publishes it; only published pages are shown to readers. */
export const PAGE_STATUSES = ["draft", "published"] as const;

/** Heading levels a page may use. Level 1 is the page's own title, so content starts at 2. */
export const RICH_TEXT_HEADING_LEVELS = [2, 3, 4] as const;

/** Inline formatting a page may use, from the brief's editor: bold and italic. */
export const RICH_TEXT_MARKS = ["bold", "italic"] as const;

/** Text field limits for chapters and pages, in characters (Unicode code points). */
export const PAGE_TEXT_LIMITS = {
  chapterTitle: { min: 1, max: 100 },
  pageTitle: { min: 1, max: 150 },
} as const satisfies Record<string, TextLimit>;
