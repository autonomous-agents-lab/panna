import AxeBuilder from "@axe-core/playwright";

import { loadConfig } from "../src/config/schema";
import { en } from "../src/i18n/messages/en";
import { hi } from "../src/i18n/messages/hi";

import { completeOnboarding, signInWithMagicLink, uniqueEmail, uniqueUsername } from "./accounts";
import { expect, test } from "./fixtures";
import { LOCAL_SUPABASE_TAG } from "./target";

const { appName } = loadConfig(process.env);
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("onboarding with local Supabase", { tag: LOCAL_SUPABASE_TAG }, () => {
  test.use({ locale: "en-US" });

  test("a new user signs up, claims a username in Hindi and lands on their book (AC-1, AC-2, AC-3, AC-6, AC-9)", async ({
    page,
  }) => {
    const username = uniqueUsername();
    await signInWithMagicLink(page, uniqueEmail());
    await expect(page).toHaveURL("/onboarding");

    // AC-1: protected pages send a user without a profile back to onboarding.
    await page.goto("/settings");
    await expect(page).toHaveURL("/onboarding");

    const field = page.getByLabel(en["onboarding.username.label"]);
    const status = page.getByRole("main").getByRole("status");
    await field.fill("Admin");
    await expect(status).toHaveText(en["username.error.reserved"]);
    await field.fill("9lives");
    await expect(status).toHaveText(en["username.error.must_start_with_letter"]);
    await field.fill(username.toUpperCase());
    await expect(status).toHaveText(en["onboarding.username.available"].replace("{username}", username));

    await page.getByLabel(en["onboarding.displayName.label"]).fill("आशा राव");
    await page.getByRole("radio", { name: "हिन्दी" }).check();
    await page.getByRole("button", { name: en["onboarding.submit"] }).click();

    await expect(page).toHaveURL(`/${username}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    const book = page.getByRole("main").locator("article");
    await expect(book).toHaveAttribute("lang", "hi");
    await expect(book.getByRole("heading", { level: 1 })).toHaveText("आशा राव");
    await expect(book).toContainText(hi["book.byline"].replace("{name}", "आशा राव"));
    await expect(page).toHaveTitle(
      `${hi["book.metaTitle"].replace("{title}", "आशा राव").replace("{name}", "आशा राव")} · ${appName}`,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${username}$`));

    // AC-6: a mixed-case URL redirects to the lowercase one.
    await page.goto(`/${username.toUpperCase()}`);
    await expect(page).toHaveURL(`/${username}`);

    // AC-1: onboarding is done, so it sends the user to their book.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(`/${username}`);
  });

  test("a name claimed by someone else between the check and submit is refused inline (AC-4)", async ({ browser }) => {
    const username = uniqueUsername();
    const first = await (await browser.newContext({ locale: "en-US" })).newPage();
    const second = await (await browser.newContext({ locale: "en-US" })).newPage();

    await signInWithMagicLink(first, uniqueEmail());
    const field = first.getByLabel(en["onboarding.username.label"]);
    await field.fill(username);
    await expect(first.getByRole("main").getByRole("status")).toHaveText(
      en["onboarding.username.available"].replace("{username}", username),
    );
    await first.getByLabel(en["onboarding.displayName.label"]).fill("First");

    await signInWithMagicLink(second, uniqueEmail());
    await completeOnboarding(second, { username: username.toUpperCase(), displayName: "Second" });

    await first.getByRole("button", { name: en["onboarding.submit"] }).click();
    const error = first.getByRole("main").getByRole("alert").filter({ hasText: en["username.error.taken"] });
    await expect(error).toBeVisible();
    await expect(first).toHaveURL("/onboarding");
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(first.getByLabel(en["onboarding.displayName.label"])).toHaveValue("First");
    await first.context().close();
    await second.context().close();
  });

  test("the form works by keyboard alone, focusing the first invalid field, with no axe violations (AC-8)", async ({
    page,
  }) => {
    await signInWithMagicLink(page, uniqueEmail());
    await expect(page).toHaveURL("/onboarding");
    expect((await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()).violations).toEqual([]);

    const username = page.getByLabel(en["onboarding.username.label"]);
    for (let presses = 0; presses < 15 && !(await username.evaluate((element) => element === document.activeElement)); presses++) {
      await page.keyboard.press("Tab");
    }
    await expect(username).toBeFocused();
    await page.keyboard.type("a");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(en["onboarding.displayName.label"])).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: "English" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: en["onboarding.submit"] })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("main").getByRole("alert").filter({ hasText: en["onboarding.displayName.error.required"] })).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("alert").filter({ hasText: en["username.error.too_short"].replace("{min}", "3") }),
    ).toBeVisible();
    await expect(username).toBeFocused();
    expect((await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()).violations).toEqual([]);
  });
});

test.describe("onboarding in Hindi with local Supabase", { tag: LOCAL_SUPABASE_TAG }, () => {
  test.use({ locale: "hi-IN" });

  test("errors are shown inline in Hindi and focus the first invalid field (AC-8)", async ({ page }) => {
    await signInWithMagicLink(page, uniqueEmail());
    await expect(page).toHaveURL("/onboarding");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await page.getByLabel(hi["onboarding.username.label"]).fill(uniqueUsername());
    await page.getByLabel(hi["onboarding.displayName.label"]).fill("x".repeat(51));
    await page.getByRole("button", { name: hi["onboarding.submit"] }).click();

    await expect(
      page.getByRole("main").getByRole("alert").filter({ hasText: hi["onboarding.displayName.error.too_long"].replace("{max}", "50") }),
    ).toBeVisible();
    await expect(page.getByLabel(hi["onboarding.displayName.label"])).toBeFocused();
  });
});

// Untagged: an unknown name is a 404 with or without Supabase, so deploys run these too.
for (const { browserLocale, t } of [
  { browserLocale: "en-US", t: en },
  { browserLocale: "hi-IN", t: hi },
]) {
  test.describe(`an unknown book in ${browserLocale} (AC-7)`, () => {
    test.use({ locale: browserLocale });

    for (const path of ["/no_such_writer_e2e", "/not-a-username"]) {
      test(`${path} is a localised 404`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(404);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(t["notFound.title"]);
      });
    }
  });
}
