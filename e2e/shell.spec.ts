import { expect, test, type Page } from "@playwright/test";

import { loadConfig } from "../src/config/schema";
import { healthResponseSchema } from "../src/contracts/health";
import { en } from "../src/i18n/messages/en";
import { hi } from "../src/i18n/messages/hi";

import { TEST_ROUTES_TAG } from "./target";

const { appName, siteUrl } = loadConfig(process.env);

const LANGUAGES = [
  { browserLocale: "en-US", t: en },
  { browserLocale: "hi-IN", t: hi },
] as const;

const HOME = "/";
const MISSING = "/this/does/not/exist";
const THROWS = "/test-only/throw";

function startsWithSiteUrl(): RegExp {
  return new RegExp(`^${siteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

async function metaContent(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((elements) => elements.map((element) => element.getAttribute("content") ?? ""));
}

async function expectSiteMetadata(page: Page, title: string) {
  await expect(page).toHaveTitle(title);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", appName);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", title);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", startsWithSiteUrl());
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", startsWithSiteUrl());
}

test.describe("metadata from config", () => {
  test.use({ locale: "en-US" });

  test("the home page takes its title, social tags and canonical from the configured name and site URL", async ({
    page,
  }) => {
    await page.goto(HOME);
    await expectSiteMetadata(page, appName);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /\/manifest\.webmanifest$/);
  });

  test("the 404 page keeps the site metadata alongside its own title", async ({ page }) => {
    await page.goto(MISSING);
    await expectSiteMetadata(page, `${en["notFound.title"]} · ${appName}`);
  });

  test("the web manifest is named after the configured app", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ name: appName, short_name: appName, start_url: "/" });
  });
});

for (const { browserLocale, t } of LANGUAGES) {
  test.describe(`in ${browserLocale}`, () => {
    test.use({ locale: browserLocale });

    for (const path of [HOME, MISSING, THROWS]) {
      const details = path === THROWS ? { tag: TEST_ROUTES_TAG } : {};
      test(`on ${path}, the first Tab focuses a visible skip link that moves focus to main`, details, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const skipLink = page.getByRole("link", { name: t["shell.skipToContent"] });
        await expect(skipLink).not.toBeInViewport();

        await page.keyboard.press("Tab");
        await expect(skipLink).toBeFocused();
        await expect(skipLink).toBeInViewport();

        await page.keyboard.press("Enter");
        await expect(page.locator("main#main")).toBeFocused();
      });
    }

    test("the home page shows the app name, tagline and locale switch inside the landmarks", async ({ page }) => {
      await page.goto(HOME);
      const main = page.getByRole("main");
      await expect(main).toHaveCount(1);
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(appName);
      await expect(main.getByText(t["home.tagline"])).toBeVisible();
      await expect(page.getByRole("banner").getByRole("group", { name: t["localeSwitch.label"] })).toBeVisible();
      await expect(page.getByRole("contentinfo")).toHaveText(t["shell.footer"].replace("{appName}", appName));
    });

    test("an unknown path is a translated, noindex 404 that links home", async ({ page }) => {
      const response = await page.goto(MISSING);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(t["notFound.title"]);
      await expect(page.getByRole("main").getByRole("link", { name: t["notFound.home"] })).toHaveAttribute("href", "/");
      await expect(page.getByRole("banner").getByRole("link", { name: appName })).toBeVisible();
      expect((await metaContent(page, 'meta[name="robots"]')).some((content) => content.includes("noindex"))).toBe(true);
    });

    test("a route that throws shows a translated error page with retry and home, and no internals", { tag: TEST_ROUTES_TAG }, async ({ page }) => {
      await page.goto(THROWS);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(t["error.title"]);
      await expect(main.getByRole("link", { name: t["error.home"] })).toHaveAttribute("href", "/");
      const retry = main.getByRole("button", { name: t["error.retry"] });

      const text = await page.locator("body").innerText();
      expect(text).not.toContain("internal secret detail");
      expect(text).not.toMatch(/\bat\s.+:\d+:\d+/);
      expect((await metaContent(page, 'meta[name="robots"]')).some((content) => content.includes("noindex"))).toBe(true);

      await retry.click();
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(t["error.title"]);
      expect(await page.locator("body").innerText()).not.toContain("internal secret detail");
    });
  });
}

test("an unknown path answers 404 to a plain request", async ({ request }) => {
  expect((await request.get(MISSING)).status()).toBe(404);
});

test("/api/health reports ok, the version and the time, uncached, with no env values", async ({ request }) => {
  const response = await request.get("/api/health");
  const text = await response.text();
  const body = healthResponseSchema.parse(JSON.parse(text));

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(Object.keys(body).sort()).toEqual(["status", "time", "version"]);
  expect(Math.abs(Date.parse(body.time) - Date.now())).toBeLessThan(60_000);

  const publicValues = Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("NEXT_PUBLIC_") && value)
    .map(([, value]) => value!);
  for (const value of [...publicValues, appName, siteUrl]) expect(text).not.toContain(value);
});
