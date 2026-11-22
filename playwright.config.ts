import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Load .env files the way Next does, so tests expect the same config the app renders.
nextEnv.loadEnvConfig(process.cwd(), !process.env.CI);

// A port of its own, and never reusing a running server, so the tests always hit the app
// Playwright started rather than a dev server or another app already on :3000.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Always the production build: the dev error overlay traps focus on pages that throw, which
    // would hide what users really get from the error page (keyboard and axe checks).
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    // Turns on /test-only/* (a route that throws, for the error page tests). Never set in Netlify.
    env: { ENABLE_TEST_ROUTES: "true" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
