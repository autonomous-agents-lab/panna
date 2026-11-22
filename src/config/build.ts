import type { RawEnv } from "./schema";

/**
 * Values `next.config.ts` inlines into the build. APP_VERSION is set at build time (netlify.toml
 * maps the host's commit SHA onto it); inlining it lets /api/health report the build's commit
 * even where the host doesn't pass build variables to server functions at runtime.
 * Unset or empty values are left out, so a runtime value still applies.
 */
export function buildTimeEnv(raw: RawEnv): Record<string, string> {
  return raw.APP_VERSION ? { APP_VERSION: raw.APP_VERSION } : {};
}
