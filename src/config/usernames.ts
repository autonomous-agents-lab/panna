// Username rules. The database mirrors the length limits in its format check and the reserved
// list in `public.is_reserved_username`; src/contracts/contracts.test.ts keeps them in step.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Names nobody can claim, because a book lives at `/<username>` and these are (or may become)
 * app routes and files. Every new top-level route must be added here and to the database list.
 * Some entries can't pass the format rules anyway; they stay listed so the intent is explicit.
 */
export const RESERVED_USERNAMES = [
  "api",
  "login",
  "logout",
  "signup",
  "signin",
  "auth",
  "callback",
  "settings",
  "onboarding",
  "feed",
  "about",
  "admin",
  "help",
  "terms",
  "privacy",
  "sitemap.xml",
  "robots.txt",
  "manifest.webmanifest",
  "favicon.ico",
  "_next",
  "static",
  "public",
  "assets",
  "new",
  "edit",
  "search",
  "explore",
  "notifications",
  "profile",
  "account",
  "book",
  "books",
  "page",
  "pages",
  "share",
  "u",
  "me",
  "home",
  "support",
  "contact",
  "test-only",
  // The reader's sample books (src/lib/reader/fixtures.ts) are served at these names.
  "sample_writer_bilingual",
  "sample_writer_empty",
  "sample_writer_drafts",
] as const;
