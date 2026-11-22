// Fixed product sets, not env. The database mirrors each list and limit in a named check
// constraint or column default; src/contracts/contracts.test.ts fails if the two drift apart.
// Adding a value takes a new migration plus a change here.

/** Cover styles a writer can pick. Placeholder names; the visual polish epic may rename them. */
export const COVER_STYLES = ["classic", "linen", "kraft", "marbled", "minimal"] as const;

/**
 * Book fonts from the product brief, all free for commercial use (OFL, except Homemade Apple,
 * which is Apache 2.0). Kalam is the default because it covers both Devanagari and Latin.
 */
export const FONT_IDS = ["kalam", "amita", "sahitya", "laila", "caveat", "homemade_apple"] as const;

/**
 * Languages a writer writes in. Same values as the UI locales in src/i18n, but a different
 * meaning: this is the language of a profile's or book's content, not of the app interface.
 */
export const CONTENT_LANGUAGES = ["hi", "en"] as const;

export const DEFAULT_COVER_STYLE = "classic" satisfies (typeof COVER_STYLES)[number];
export const DEFAULT_FONT = "kalam" satisfies (typeof FONT_IDS)[number];
export const DEFAULT_CONTENT_LANGUAGE = "en" satisfies (typeof CONTENT_LANGUAGES)[number];

export interface TextLimit {
  /** Inclusive, in characters (Unicode code points, as Postgres `char_length` counts them). */
  min: number;
  max: number;
}

/** Text field limits for profiles and books. */
export const TEXT_LIMITS = {
  displayName: { min: 1, max: 50 },
  bio: { min: 0, max: 160 },
  avatarPath: { min: 1, max: 512 },
  bookTitle: { min: 1, max: 100 },
  bookSubtitle: { min: 0, max: 150 },
} as const satisfies Record<string, TextLimit>;
