import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loadConfig } from "../src/config/schema";
import { en } from "../src/i18n/messages/en";
import { hi } from "../src/i18n/messages/hi";

const { appName } = loadConfig(process.env);

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PHONE = { width: 375, height: 812 };

for (const { browserLocale, lang, t } of [
  { browserLocale: "en-US", lang: "en", t: en },
  { browserLocale: "hi-IN", lang: "hi", t: hi },
] as const) {
  test.describe(`the Coming soon home page in ${browserLocale} at phone width`, () => {
    test.use({ locale: browserLocale, viewport: PHONE });

    test("shows the product name, Coming soon and a one-line description", async ({ page }) => {
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(appName);
      await expect(main.getByText(t["home.comingSoon"], { exact: true })).toBeVisible();
      await expect(main.getByText(t["home.tagline"], { exact: true })).toBeVisible();
    });

    test("does not scroll sideways", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test("has no axe violations", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

      expect(violations).toEqual([]);
    });
  });
}
