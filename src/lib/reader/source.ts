import "server-only";

import type { BookSource } from "@/contracts";

import { sampleBookStore } from "./fixtures";
import { createMemoryBookSource } from "./memory-source";

// The one place the reader's data source is chosen. Story 8 swaps in the Supabase source here.
const bookSource = createMemoryBookSource(sampleBookStore);

export function getBookSource(): BookSource {
  return bookSource;
}
