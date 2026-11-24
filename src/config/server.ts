import "server-only";

import { z } from "zod";

import packageJson from "../../package.json";

import type { RawEnv } from "./schema";
import { DEFAULT_WRITING_DATA_SOURCE, WRITING_DATA_SOURCES, type WritingDataSource } from "./writing";

export type ServerConfig = {
  /** The build's commit SHA when APP_VERSION is set, otherwise the package version. */
  version: string;
  /** Turns on routes that exist only for end-to-end tests. Never set in Netlify. */
  testRoutes: boolean;
  /** Where chapters and pages are read and written (WRITING_DATA_SOURCE). */
  writingDataSource: WritingDataSource;
  /**
   * Whether /write and the editor are served while chapters and pages live in the stand-in
   * in-memory store, which every visitor would share (ENABLE_STAND_IN_WRITING).
   */
  standInWriting: boolean;
};

/**
 * Every variable this module reads. Host variables (e.g. the host's commit SHA) are never read
 * here: netlify.toml maps them onto APP_VERSION, so app code stays host-agnostic.
 */
export const SERVER_ENV_VARIABLES = [
  "APP_VERSION",
  "ENABLE_TEST_ROUTES",
  "WRITING_DATA_SOURCE",
  "ENABLE_STAND_IN_WRITING",
  "NODE_ENV",
] as const;

const commitSha = z.string().trim().regex(/^[0-9a-f]{7,40}$/i);

const writingDataSource = z.enum(WRITING_DATA_SOURCES).default(DEFAULT_WRITING_DATA_SOURCE);

/** Unset means the default; any other value must be a known source. The value itself is never echoed. */
function parseWritingDataSource(value: string | undefined): WritingDataSource {
  const parsed = writingDataSource.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Error(`WRITING_DATA_SOURCE must be one of: ${WRITING_DATA_SOURCES.join(", ")}`);
}

const onOff = z.enum(["true", "false"]).optional();

/**
 * An explicit true or false wins. Unset, it is on only in development and tests, so a production
 * build never serves the shared stand-in store unless its deploy turns it on.
 */
function parseStandInWriting(value: string | undefined, nodeEnv: string | undefined): boolean {
  const parsed = onOff.safeParse(value);
  if (!parsed.success) throw new Error("ENABLE_STAND_IN_WRITING must be true or false");
  if (parsed.data === undefined) return nodeEnv === "development" || nodeEnv === "test";
  return parsed.data === "true";
}

/**
 * Server-only settings, kept apart from the NEXT_PUBLIC_* config that is inlined into client
 * bundles. Only a value that looks like a commit SHA is used as the version, so no arbitrary
 * env value is ever echoed back (e.g. by /api/health).
 */
export function loadServerConfig(raw: RawEnv, fallbackVersion: string = packageJson.version): ServerConfig {
  const sha = commitSha.safeParse(raw.APP_VERSION);
  return {
    version: sha.success ? sha.data : fallbackVersion,
    testRoutes: raw.ENABLE_TEST_ROUTES === "true",
    writingDataSource: parseWritingDataSource(raw.WRITING_DATA_SOURCE),
    standInWriting: parseStandInWriting(raw.ENABLE_STAND_IN_WRITING, raw.NODE_ENV),
  };
}

// Each variable is read literally so Next.js can inline APP_VERSION from next.config.ts `env`.
export const serverConfig = loadServerConfig({
  APP_VERSION: process.env.APP_VERSION,
  ENABLE_TEST_ROUTES: process.env.ENABLE_TEST_ROUTES,
  WRITING_DATA_SOURCE: process.env.WRITING_DATA_SOURCE,
  ENABLE_STAND_IN_WRITING: process.env.ENABLE_STAND_IN_WRITING,
  NODE_ENV: process.env.NODE_ENV,
});
