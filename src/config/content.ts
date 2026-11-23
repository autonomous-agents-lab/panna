// Chapters, pages and the page body format (docs/content-format.md). Fixed product rules, not env.
// The database mirrors the statuses and PAGE_BODY_DB_MAX_BYTES in named check constraints;
// src/contracts/contracts.test.ts fails if the two drift apart.

/** A chapter or page is a draft (only its writer sees it) or published. */
export const CONTENT_STATUSES = ["draft", "published"] as const;

/** Largest page body the sanitiser accepts, in UTF-8 bytes of its JSON.stringify form. */
export const PAGE_BODY_MAX_BYTES = 200_000;

/**
 * The database's backstop for the same limit, in bytes of `body::text`. Looser on purpose:
 * Postgres puts a space after every ':' and ',', so it measures a body 10-15% larger than
 * JSON.stringify does, and a body the sanitiser accepts must never fail this check.
 */
export const PAGE_BODY_DB_MAX_BYTES = 300_000;

/** Deepest nesting of objects and arrays the sanitiser reads. Valid bodies nest 9 levels at most. */
export const PAGE_BODY_MAX_DEPTH = 16;

/** Heading levels a page may use. Level 1 is the page's own title, so pages start at 2. */
export const HEADING_LEVELS = [2, 3] as const;

/** Image alt text limit, in characters (code points). */
export const IMAGE_ALT_MAX_LENGTH = 250;

/** Image src limit, in characters. Valid srcs are ASCII. */
export const IMAGE_SRC_MAX_LENGTH = 1024;

/** The Supabase Storage bucket page images live in. The image-upload story creates it. */
export const PAGE_IMAGES_BUCKET = "page-images";
