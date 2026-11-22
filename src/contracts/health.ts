import { z } from "zod";

/** `GET /api/health` response body. Exactly these keys; it never carries env values or secrets. */
export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
  /** Commit SHA of the running build when the host provides one, otherwise the package version. */
  version: z.string().min(1),
  /** Server time, ISO 8601 in UTC. */
  time: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
