import "server-only";

import { getSupabaseConfig, type WritingDataSource } from "@/config";
import { serverConfig } from "@/config/server";
import type { GetCurrentWriter, PageBodyOptions, WritingRepository } from "@/contracts";

import { createInMemoryWritingRepository } from "./in-memory-repository";
import { STAND_IN_WRITER, getStandInWriter } from "./stand-in-writer";
import { withValidation } from "./validating-repository";

export interface WritingServices {
  /** Validates every input before it reaches the data source. */
  repository: WritingRepository;
  getCurrentWriter: GetCurrentWriter;
}

export interface WritingServicesOptions {
  dataSource?: WritingDataSource;
  /** Where page images may come from. Defaults to the Supabase URL from config (no Supabase call). */
  pageBody?: PageBodyOptions;
}

// One store per server process, kept on globalThis so it survives dev hot reloads.
const processStore = globalThis as typeof globalThis & { standInWritingRepository?: WritingRepository };

function standInRepository(): WritingRepository {
  processStore.standInWritingRepository ??= createInMemoryWritingRepository({
    books: [{ id: STAND_IN_WRITER.bookId, userId: STAND_IN_WRITER.userId }],
  });
  return processStore.standInWritingRepository;
}

/** The writing repository and current-writer lookup for the configured WRITING_DATA_SOURCE. */
export function getWritingServices({
  dataSource = serverConfig.writingDataSource,
  pageBody = { storageUrl: getSupabaseConfig().url },
}: WritingServicesOptions = {}): WritingServices {
  switch (dataSource) {
    case "stand-in":
      return { repository: withValidation(standInRepository(), pageBody), getCurrentWriter: getStandInWriter };
  }
}

export type { InMemoryBook, InMemoryWritingOptions } from "./in-memory-repository";
export { createInMemoryWritingRepository } from "./in-memory-repository";
export { STAND_IN_WRITER, getStandInWriter } from "./stand-in-writer";
export { withValidation } from "./validating-repository";
