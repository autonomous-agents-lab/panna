import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

import { resolveTarget } from "./e2e/target";

// Load .env files the way Next does, so tests expect the same config the app renders.
nextEnv.loadEnvConfig(process.cwd(), !process.env.CI);

const { baseURL, webServer, grepInvert } = resolveTarget(process.env);

// The tests read config from process.env, so they must expect the site URL the server got.
if (webServer) process.env.NEXT_PUBLIC_SITE_URL = baseURL;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  grepInvert,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // A port of its own, and never reusing a running server, so local runs always hit the app
  // Playwright started rather than a dev server or another app already on :3000.
  webServer: webServer && { ...webServer, reuseExistingServer: false, timeout: 120_000 },
});
