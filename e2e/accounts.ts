import type { Page } from "@playwright/test";

import type { Catalogue } from "../src/i18n/catalogue";
import { en } from "../src/i18n/messages/en";

import { expect } from "./fixtures";
import { firstLink, latestEmailTo } from "./mailpit";

/** A fresh address, so every run signs up a brand-new user. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.org`;
}

/** A fresh, valid username (a letter first, at most 30 characters). */
export function uniqueUsername(): string {
  return `e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Asks for a magic link on /login and opens it; the caller checks where it lands.
 * `t` must be the catalogue the page renders in, which follows the browser locale.
 */
export async function signInWithMagicLink(
  page: Page,
  address: string,
  { path = "/login", t = en }: { path?: string; t?: Catalogue } = {},
): Promise<void> {
  await page.goto(path);
  await page.getByLabel(t["auth.login.emailLabel"]).fill(address);
  await page.getByRole("button", { name: t["auth.login.submit"] }).click();
  await expect(page.getByRole("status")).toHaveText(t["auth.login.sent"].replace("{email}", address));
  await page.goto(firstLink((await latestEmailTo(address)).html));
}

/** Fills and submits the onboarding form (in English) and waits for the new book at the lowercase name. */
export async function completeOnboarding(
  page: Page,
  { username, displayName, language = "en" }: { username: string; displayName: string; language?: "en" | "hi" },
): Promise<void> {
  await expect(page).toHaveURL("/onboarding");
  await page.getByLabel(en["onboarding.username.label"]).fill(username);
  await page.getByLabel(en["onboarding.displayName.label"]).fill(displayName);
  await page.getByRole("radio", { name: language === "hi" ? "हिन्दी" : "English" }).check();
  await page.getByRole("button", { name: en["onboarding.submit"] }).click();
  await expect(page).toHaveURL(`/${username.toLowerCase()}`);
}
