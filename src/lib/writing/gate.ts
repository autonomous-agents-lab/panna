import type { ServerConfig } from "@/config/server";

/**
 * Whether /write and the editor are served. The stand-in store is one book that every visitor
 * would share, so with it they are served only where ENABLE_STAND_IN_WRITING allows (off in
 * production builds by default). The story that adds the Supabase data source adds its case.
 */
export function writingRoutesEnabled({
  writingDataSource,
  standInWriting,
}: Pick<ServerConfig, "writingDataSource" | "standInWriting">): boolean {
  switch (writingDataSource) {
    case "stand-in":
      return standInWriting;
  }
}
