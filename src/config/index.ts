import { loadConfig } from "./schema";

export type { Config } from "./schema";

// Each variable is read literally so Next.js can inline it into client bundles.
export const config = loadConfig({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND: process.env.NEXT_PUBLIC_FEATURE_PAGE_TURN_SOUND,
  NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB: process.env.NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB,
});
