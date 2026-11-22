import { notFound } from "next/navigation";

import { serverConfig } from "@/config/server";
import { pageMetadata } from "@/lib/page-metadata";

// Exists so end-to-end tests can check the error page against a route that really throws.
// It is a 404 unless ENABLE_TEST_ROUTES=true, which is never set in Netlify.
export function generateMetadata() {
  if (!serverConfig.testRoutes) notFound();
  return pageMetadata({ path: "/test-only/throw", titleKey: "error.title", noindex: true });
}

export default function ThrowPage(): never {
  if (!serverConfig.testRoutes) notFound();
  throw new Error("internal secret detail");
}
