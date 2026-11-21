import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Load .env files the way Next does, so tests expect the same config the app renders.
nextEnv.loadEnvConfig(process.cwd(), !process.env.CI);

// `next dev` and `next start` also read PORT, so overriding it moves both together.
const port = Number(process.env.PORT ?? 3000);
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
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
