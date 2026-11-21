import { z } from "zod";

import {
  DEFAULT_APP_NAME,
  DEFAULT_FEATURE_PAGE_TURN_SOUND,
  DEFAULT_MAX_IMAGE_UPLOAD_MB,
  DEFAULT_SITE_URL,
} from "./defaults";

export const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default(DEFAULT_APP_NAME),
  NEXT_PUBLIC_SITE_URL: z.url().default(DEFAULT_SITE_URL),
  NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND: z
    .stringbool()
    .default(DEFAULT_FEATURE_PAGE_TURN_SOUND),
  NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_IMAGE_UPLOAD_MB),
});

export type RawEnv = Record<string, string | undefined>;

export type Config = {
  appName: string;
  siteUrl: string;
  features: { pageTurnSound: boolean };
  limits: { maxImageUploadMb: number };
};

/** Validates raw env values and maps them to app config. Throws a ZodError naming the bad variable. */
export function loadConfig(raw: RawEnv): Config {
  const env = envSchema.parse(raw);
  return {
    appName: env.NEXT_PUBLIC_APP_NAME,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    features: { pageTurnSound: env.NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND },
    limits: { maxImageUploadMb: env.NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB },
  };
}
