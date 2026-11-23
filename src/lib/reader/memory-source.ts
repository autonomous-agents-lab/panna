import type { BookSource } from "@/contracts";

import { toReaderBook, toReaderPage, type BookStore } from "./project";

/** A `BookSource` over rows held in memory: the stand-in until the Supabase source lands. */
export function createMemoryBookSource(store: BookStore): BookSource {
  return {
    getPublishedBook: async (username) => toReaderBook(store, username),
    getPublishedPage: async (username, pageId) => toReaderPage(store, username, pageId),
  };
}
