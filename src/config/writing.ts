import type { TextLimit } from "./books";

/**
 * Where the writing epic reads and writes chapters and pages (WRITING_DATA_SOURCE). `stand-in` is
 * an in-memory store with a fixed writer, for building the writing UI before auth and the real
 * tables are wired up. The story that adds the Supabase adapter adds `supabase` and makes it the
 * production default, so production never writes to memory.
 */
export const WRITING_DATA_SOURCES = ["stand-in"] as const;

export type WritingDataSource = (typeof WRITING_DATA_SOURCES)[number];

export const DEFAULT_WRITING_DATA_SOURCE = "stand-in" satisfies WritingDataSource;

/** A page title is optional; when present it is this long after trimming, in characters (code points). */
export const PAGE_TITLE_LIMIT = { min: 1, max: 100 } as const satisfies TextLimit;
