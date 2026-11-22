import "server-only";

import { z } from "zod";

import packageJson from "../../package.json";

import type { RawEnv } from "./schema";

export type ServerConfig = {
  /** The build's commit SHA when APP_VERSION is set, otherwise the package version. */
  version: string;
  /** Turns on routes that exist only for end-to-end tests. Never set in Netlify. */
  testRoutes: boolean;
};

/**
 * Every variable this module reads. Host variables (e.g. the host's commit SHA) are never read
 * here: netlify.toml maps them onto APP_VERSION, so app code stays host-agnostic.
 */
export const SERVER_ENV_VARIABLES = ["APP_VERSION", "ENABLE_TEST_ROUTES"] as const;

const commitSha = z.string().trim().regex(/^[0-9a-f]{7,40}$/i);

/**
 * Server-only settings, kept apart from the NEXT_PUBLIC_* config that is inlined into client
 * bundles. Only a value that looks like a commit SHA is used as the version, so no arbitrary
 * env value is ever echoed back (e.g. by /api/health).
 */
export function loadServerConfig(raw: RawEnv, fallbackVersion: string = packageJson.version): ServerConfig {
  const sha = commitSha.safeParse(raw.APP_VERSION);
  return { version: sha.success ? sha.data : fallbackVersion, testRoutes: raw.ENABLE_TEST_ROUTES === "true" };
}

// Each variable is read literally so Next.js can inline APP_VERSION from next.config.ts `env`.
export const serverConfig = loadServerConfig({
  APP_VERSION: process.env.APP_VERSION,
  ENABLE_TEST_ROUTES: process.env.ENABLE_TEST_ROUTES,
});
