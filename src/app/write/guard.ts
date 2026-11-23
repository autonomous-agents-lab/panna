import "server-only";

import { notFound, redirect } from "next/navigation";

import { serverConfig } from "@/config/server";
import { getWritingServices } from "@/lib/writing";
import { writingRoutesEnabled } from "@/lib/writing/gate";
import { requireWriter } from "@/lib/writing/require-writer";
import { WRITE_PATH } from "@/lib/writing/routes";

/** A 404 unless the writing routes are served (see ENABLE_STAND_IN_WRITING). */
export function assertWritingEnabled(): void {
  if (!writingRoutesEnabled(serverConfig)) notFound();
}

/**
 * The writing services and the signed-in writer, for /write and the pages under it. A signed-out
 * visitor is sent to sign in and comes back to /write.
 */
export async function loadWriting() {
  assertWritingEnabled();
  const services = getWritingServices();
  const writer = await requireWriter(services.getCurrentWriter, redirect, WRITE_PATH);
  return { ...services, writer };
}
