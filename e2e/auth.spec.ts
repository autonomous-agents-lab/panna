import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { loadConfig } from "../src/config/schema";
import { en } from "../src/i18n/messages/en";
import { hi } from "../src/i18n/messages/hi";

import { completeOnboarding, uniqueEmail, uniqueUsername } from "./accounts";
import { expect, test } from "./fixtures";
import { firstLink, latestEmailTo } from "./mailpit";
import { LOCAL_SUPABASE_TAG } from "./target";

const { appName, siteUrl } = loadConfig(process.env);
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const LANGUAGES = [
  { browserLocale: "en-US", lang: "en", t: en },
  { browserLocale: "hi-IN", lang: "hi", t: hi },
] as const;

const SIGN_IN_UNAVAILABLE =
  "/login says sign-in is unavailable: the app was built without NEXT_PUBLIC_SUPABASE_URL and " +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY. Tests tagged ${LOCAL_SUPABASE_TAG} need the local stack; see "Local Supabase" ` +
  "in the README.";

/** Opens `url`, which shows the sign-in form, and fails at once with the cause if the deploy can't offer sign-in. */
async function gotoSignIn(page: Page, url: string, t: Record<"auth.login.unavailable", string> = en) {
  await page.goto(url);
  await expect(page.getByText(t["auth.login.unavailable"]), SIGN_IN_UNAVAILABLE).toHaveCount(0);
}

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(violations).toEqual([]);
}

async function expectNoindex(page: Page) {
  const robots = await page.locator('meta[name="robots"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("content") ?? ""),
  );
  expect(robots.some((content) => content.includes("noindex"))).toBe(true);
}

for (const { browserLocale, lang, t } of LANGUAGES) {
  test.describe(`sign-in in ${browserLocale}`, { tag: LOCAL_SUPABASE_TAG }, () => {
    test.use({ locale: browserLocale });

    test("/login is a translated, noindex page with a labelled email field and no axe violations", async ({ page }) => {
      await gotoSignIn(page, "/login", t);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page).toHaveTitle(`${t["auth.login.title"]} · ${appName}`);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(t["auth.login.title"]);
      await expect(page.getByLabel(t["auth.login.emailLabel"])).toBeVisible();
      await expect(page.getByRole("button", { name: t["auth.login.google"] })).toBeVisible();
      await expectNoindex(page);
      await expectNoAxeViolations(page);
    });

    test("an invalid email shows an inline, labelled error in that language", async ({ page }) => {
      await gotoSignIn(page, "/login", t);
      const email = page.getByLabel(t["auth.login.emailLabel"]);
      await email.fill("not-an-email");
      await page.getByRole("button", { name: t["auth.login.submit"] }).click();

      const error = page.getByRole("main").getByText(t["auth.error.emailInvalid"]);
      await expect(error).toBeVisible();
      await expect(error).toHaveAttribute("role", "alert");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(email).toHaveAttribute("aria-describedby", (await error.getAttribute("id")) ?? "missing id");
      await expect(email).toHaveValue("not-an-email");
      await expect(page.getByRole("status")).toBeEmpty();
      await expectNoAxeViolations(page);
    });

    test("a failed or expired link lands on /login with a translated error and the email field ready", async ({ page }) => {
      await gotoSignIn(page, "/auth/callback?code=bogus&next=%2Fsettings", t);
      await expect(page).toHaveURL("/login?error=link_invalid&next=%2Fsettings");
      await expect(page.getByRole("alert").filter({ hasText: t["auth.error.linkInvalid"] })).toBeVisible();
      await expect(page.getByLabel(t["auth.login.emailLabel"])).toBeFocused();
      await expect(page.getByRole("button", { name: t["auth.login.submit"] })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
}

test.describe("sign-in with the keyboard", { tag: LOCAL_SUPABASE_TAG }, () => {
  test.use({ locale: "en-US" });

  test("every control on /login is reached in order, with a visible focus ring", async ({ page }) => {
    await gotoSignIn(page, "/login");
    const email = page.getByLabel(en["auth.login.emailLabel"]);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: en["shell.skipToContent"] })).toBeFocused();
    // Then the header's controls, then the form.
    for (let presses = 0; presses < 10 && !(await email.evaluate((element) => element === document.activeElement)); presses++) {
      await page.keyboard.press("Tab");
    }
    for (const control of [
      email,
      page.getByRole("button", { name: en["auth.login.submit"] }),
      page.getByRole("button", { name: en["auth.login.google"] }),
    ]) {
      await expect(control).toBeFocused();
      expect(await control.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
      await page.keyboard.press("Tab");
    }
  });
});

// Untagged: signed-out visitors are redirected with or without Supabase, so deploys run these too.
test.describe("protected pages", () => {
  for (const path of ["/settings", "/onboarding"]) {
    test(`a signed-out visit to ${path} goes to /login with next`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(en["auth.login.title"]);
    });
  }
});

test("Continue with Google goes to Supabase's Google flow with the callback built from config", { tag: LOCAL_SUPABASE_TAG }, async ({ page }) => {
  // Google can't be completed without real credentials, so stop at Supabase's authorize step.
  const isAuthorize = (url: URL) => url.pathname.endsWith("/auth/v1/authorize");
  await page.route(isAuthorize, (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "" }));
  await gotoSignIn(page, "/login?next=%2Fsettings");

  const [authorize] = await Promise.all([
    page.waitForRequest((request) => isAuthorize(new URL(request.url()))),
    page.getByRole("button", { name: en["auth.login.google"] }).click(),
  ]);

  const params = new URL(authorize.url()).searchParams;
  expect(params.get("provider")).toBe("google");
  expect(params.get("redirect_to")).toBe(new URL("/auth/callback?next=%2Fsettings", siteUrl).href);
});

test.describe("with local Supabase", { tag: LOCAL_SUPABASE_TAG }, () => {
  test.use({ locale: "en-US" });

  test("a magic link signs in a new user to onboarding, then the page asked for, and sign out returns home signed out", async ({
    page,
  }) => {
    const address = uniqueEmail();

    await page.goto("/settings");
    await expect(page).toHaveURL("/login?next=%2Fsettings");
    await page.getByLabel(en["auth.login.emailLabel"]).fill(address);
    await page.getByRole("button", { name: en["auth.login.submit"] }).click();
    await expect(page.getByRole("status")).toHaveText(en["auth.login.sent"].replace("{email}", address));

    const email = await latestEmailTo(address);
    expect(email.subject).toContain(appName);
    expect(email.html).toContain(appName);

    await page.goto(firstLink(email.html));
    // A brand-new user has no profile yet, so sign-in lands on onboarding (BOOK-20) first.
    await expect(page).toHaveURL("/onboarding");
    await completeOnboarding(page, { username: uniqueUsername(), displayName: "E2E Writer" });

    await page.goto("/settings");
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(en["settings.title"]);
    await expect(page.getByRole("main")).toContainText(en["auth.signedInAs"].replace("{email}", address));

    await page.getByRole("banner").getByRole("button", { name: en["auth.nav.signOut"] }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("banner").getByRole("link", { name: en["auth.nav.signIn"] })).toBeVisible();

    await page.goto("/settings");
    await expect(page).toHaveURL("/login?next=%2Fsettings");
  });
});
