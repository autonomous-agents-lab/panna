import { expect, test } from "@playwright/test";

import { loadConfig } from "../src/config/schema";

const { appName } = loadConfig(process.env);

test("home page renders the configured app name without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(appName);
  await expect(page).toHaveTitle(appName);
  await expect(page.locator("html")).toHaveAttribute("lang", /.+/);
  expect(errors).toEqual([]);
});
