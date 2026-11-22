import type { HealthResponse } from "@/contracts/health";

/** The `/api/health` body. It reports the app itself and deliberately checks no dependencies. */
export function buildHealth({ version, now }: { version: string; now: Date }): HealthResponse {
  return { status: "ok", version, time: now.toISOString() };
}
