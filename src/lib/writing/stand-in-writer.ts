import type { CurrentWriter, GetCurrentWriter } from "@/contracts";

/** The one writer and book the stand-in data source knows. Fixed ids, so links survive restarts. */
export const STAND_IN_WRITER: CurrentWriter = {
  userId: "00000000-0000-4000-8000-000000000001",
  bookId: "00000000-0000-4000-8000-000000000002",
};

/** Always signed in as STAND_IN_WRITER, until the auth epic's getCurrentWriter replaces it. */
export const getStandInWriter: GetCurrentWriter = async () => ({ ...STAND_IN_WRITER });
