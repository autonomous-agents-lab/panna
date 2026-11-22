import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const PAGES = [
  { name: "home", path: "/" },
  { name: "404", path: "/this/does/not/exist" },
  { name: "error", path: "/test-only/throw" },
];

for (const { browserLocale, lang } of [
  { browserLocale: "en-US", lang: "en" },
  { browserLocale: "hi-IN", lang: "hi" },
]) {
  test.describe(`in ${browserLocale}`, () => {
    test.use({ locale: browserLocale });

    for (const { name, path } of PAGES) {
      test(`the ${name} page has no axe violations`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();

        const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

        expect(violations).toEqual([]);
      });
    }
  });
}
