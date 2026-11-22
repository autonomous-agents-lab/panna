import type { Locator, Page } from "@playwright/test";

import { en } from "../src/i18n/messages/en";
import { hi } from "../src/i18n/messages/hi";

import { expect, test } from "./fixtures";
import { isHostTooling, resolveTarget } from "./target";

const ENGLISH_TAGLINE = en["home.tagline"];
const HINDI_TAGLINE = hi["home.tagline"];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectEnglish(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText(ENGLISH_TAGLINE)).toBeVisible();
  await expect(page.getByRole("group", { name: "Language" })).toBeVisible();
}

async function expectHindi(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByText(HINDI_TAGLINE)).toBeVisible();
  await expect(page.getByRole("group", { name: "भाषा" })).toBeVisible();
}

/** Presses Tab until `target` has focus, as a keyboard-only user would. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 20; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test.describe("with no locale cookie and a browser preferring Hindi", () => {
  test.use({ locale: "hi-IN" });

  test("the home page is in Hindi", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await expectHindi(page);
    expect(errors).toEqual([]);
  });
});

for (const locale of ["en-US", "fr-FR"]) {
  test.describe(`with no locale cookie and a browser preferring ${locale}`, () => {
    test.use({ locale });

    test("the home page is in English", async ({ page }) => {
      await page.goto("/");
      await expectEnglish(page);
    });
  });
}

test.describe("the locale switch", () => {
  test.use({ locale: "en-US" });

  test("switches language in place and remembers it across reloads and tabs", async ({ page, context }) => {
    const errors = collectErrors(page);
    await page.goto("/?from=test");
    await expectEnglish(page);
    const url = page.url();

    await page.getByRole("button", { name: "हिन्दी" }).click();
    await expectHindi(page);
    expect(page.url()).toBe(url);
    await expect(page.getByRole("button", { name: "हिन्दी" })).toHaveAttribute("aria-pressed", "true");

    const cookie = (await context.cookies()).find(({ name }) => name === "locale");
    expect(cookie).toMatchObject({ value: "hi", path: "/", httpOnly: true, sameSite: "Lax" });
    const yearFromNow = Date.now() / 1000 + 365 * 24 * 60 * 60;
    expect(Math.abs((cookie?.expires ?? 0) - yearFromNow)).toBeLessThan(120);

    await page.reload();
    await expectHindi(page);

    const newTab = await context.newPage();
    await newTab.goto("/");
    await expectHindi(newTab);

    await page.getByRole("button", { name: "English" }).click();
    await expectEnglish(page);
    expect(page.url()).toBe(url);
    expect(errors).toEqual([]);
  });

  test("works with the keyboard alone and is named in the current language", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("group", { name: "Language" })).toBeVisible();
    await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "हिन्दी" })).toHaveAttribute("lang", "hi");

    await tabTo(page, page.getByRole("button", { name: "हिन्दी" }));
    await page.keyboard.press("Enter");
    await expectHindi(page);

    await page.locator("body").focus();
    await tabTo(page, page.getByRole("button", { name: "English" }));
    await page.keyboard.press("Space");
    await expectEnglish(page);
  });

  test("works without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, locale: "en-US", baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "हिन्दी" }).click();
    await expectHindi(page);
    await page.reload();
    await expectHindi(page);
    await context.close();
  });
});

test.describe("fonts", () => {
  test.use({ locale: "hi-IN" });

  test("Hindi text uses the self-hosted Devanagari face, loaded with swap and no external request", async ({
    page,
    baseURL,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    await page.goto("/");
    await expectHindi(page);
    await page.evaluate(() => document.fonts.ready);

    const fonts = await page.evaluate(() => {
      const firstFamily = (stack: string) => stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
      const variable = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name);
      const devanagari = firstFamily(variable("--font-face-devanagari"));
      const latin = firstFamily(variable("--font-face-latin"));
      const tagline = [...document.querySelectorAll("p")].find((element) => element.lang !== "en" && element.textContent);
      const hindiOption = document.querySelector('button[lang="hi"]');
      const faces = [...document.styleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
        .filter((rule) => rule.style.getPropertyValue("src").includes("url("))
        .map((rule) => ({
          family: firstFamily(rule.style.getPropertyValue("font-family")),
          display: rule.style.getPropertyValue("font-display"),
        }));
      return {
        devanagari,
        latin,
        taglineFamily: firstFamily(getComputedStyle(tagline!).fontFamily),
        optionFamily: firstFamily(getComputedStyle(hindiOption!).fontFamily),
        faces,
        loaded: [...document.fonts]
          .filter((face) => face.status === "loaded")
          .map((face) => face.family.replace(/^["']|["']$/g, "")),
      };
    });

    expect(fonts.devanagari).not.toBe("");
    expect(fonts.taglineFamily).toBe(fonts.devanagari);
    expect(fonts.optionFamily).toBe(fonts.devanagari);
    expect(fonts.loaded).toContain(fonts.devanagari);

    const faces = fonts.faces.filter(({ family }) => [fonts.devanagari, fonts.latin].includes(family));
    expect(faces.map(({ family }) => family)).toEqual(expect.arrayContaining([fonts.devanagari, fonts.latin]));
    for (const face of faces) expect(face.display).toBe("swap");

    const origin = new URL(baseURL!).origin;
    const target = resolveTarget(process.env);
    const external = requests.filter((url) => new URL(url).origin !== origin && !isHostTooling(url, target));
    expect(external).toEqual([]);
  });
});

test.describe("a tampered locale cookie", () => {
  test.use({ locale: "hi-IN" });

  for (const value of ["xx", "HI%20", "en%3Bdrop", "..%2F..", "%E0%A4%A", "x".repeat(3000)]) {
    test(`falls back to English for ${value.slice(0, 20)}`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "locale", value, url: baseURL! }]);
      const errors = collectErrors(page);

      const response = await page.goto("/");

      expect(response?.status()).toBe(200);
      await expectEnglish(page);
      expect(errors).toEqual([]);
    });
  }
});

test("pages are not shared between locales by caches", async ({ request }) => {
  const english = await request.get("/", { headers: { cookie: "locale=en" } });
  const hindi = await request.get("/", { headers: { cookie: "locale=hi" } });

  expect(await english.text()).toContain('lang="en"');
  expect(await hindi.text()).toContain('lang="hi"');
  expect(hindi.headers()["cache-control"]).toMatch(/no-store|private/);
});
