import { serverConfig } from "@/config/server";
import { buildHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

// Reports only that the app is up. It doesn't query Supabase: the hosted keys arrive in Epic 2.
export function GET(): Response {
  return Response.json(buildHealth({ version: serverConfig.version, now: new Date() }), {
    headers: { "Cache-Control": "no-store" },
  });
}
