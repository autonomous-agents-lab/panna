import "server-only";

import { z } from "zod";

import packageJson from "../../package.json";

import type { RawEnv } from "./schema";

export type ServerConfig = {
  /** A commit SHA when the host provides one, otherwise the package version. */
  version: string;
  /** Turns on routes that exist only for end-to-end tests. Never set in Netlify. */
  testRoutes: boolean;
};

/** Every variable this module reads. COMMIT_REF and GITHUB_SHA are set by the host, not by us. */
export const SERVER_ENV_VARIABLES = ["APP_VERSION", "COMMIT_REF", "GITHUB_SHA", "ENABLE_TEST_ROUTES"] as const;

const commitSha = z.string().trim().regex(/^[0-9a-f]{7,40}$/i);

/**
 * Server-only settings, kept apart from the NEXT_PUBLIC_* config that is inlined into client
 * bundles. Only a value that looks like a commit SHA is used as the version, so no arbitrary
 * env value is ever echoed back (e.g. by /api/health).
 */
export function loadServerConfig(raw: RawEnv, fallbackVersion: string = packageJson.version): ServerConfig {
  // APP_VERSION is ours; COMMIT_REF is set by Netlify and GITHUB_SHA by GitHub Actions.
  const sha = [raw.APP_VERSION, raw.COMMIT_REF, raw.GITHUB_SHA]
    .map((candidate) => commitSha.safeParse(candidate))
    .find((result) => result.success)?.data;
  return { version: sha ?? fallbackVersion, testRoutes: raw.ENABLE_TEST_ROUTES === "true" };
}

export const serverConfig = loadServerConfig(
  Object.fromEntries(SERVER_ENV_VARIABLES.map((name) => [name, process.env[name]])),
);
