import type { Locator, Page, Route } from "@playwright/test";

import { en } from "../src/i18n/messages/en";
import { hi } from "../src/i18n/messages/hi";

import { expect, test } from "./fixtures";
import { IN_MEMORY_STORE_TAG, resolveTarget } from "./target";

const { standInWriting } = resolveTarget(process.env);

/** Presses Tab until `target` has focus, as a keyboard-only user would. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 60; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

const chapterHeadings = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 });

// Doesn't depend on stored data, so it also runs against Deploy Previews, where stand-in writing
// is off and /write is a 404. Next adds its own robots noindex tag to a 404 on top of the page's
// metadata one, so there every robots tag, not just one, must say noindex.
test("/write is noindex", async ({ page }) => {
  const response = await page.goto("/write");
  expect(response?.status()).toBe(standInWriting ? 200 : 404);

  const tags = page.locator('meta[name="robots"]');
  await expect(tags.first()).toBeAttached();
  for (const content of await tags.evaluateAll((elements) => elements.map((e) => e.getAttribute("content") ?? ""))) {
    expect(content).toMatch(/noindex/);
  }
});

// One server process, one in-memory book: these run in order on a fresh server, empty state
// first, and are never retried against data a failed attempt left behind.
test.describe("the writing dashboard flow", { tag: IN_MEMORY_STORE_TAG }, () => {
  test.describe.configure({ mode: "serial", retries: 0 });
  test.use({ locale: "en-US" });

  test("a new writer sees the empty state and starts their first page in the editor (AC-1)", async ({ page }) => {
    await page.goto("/write");
    await expect(page.getByRole("heading", { level: 2, name: en["write.empty.heading"] })).toBeVisible();

    await page.getByRole("button", { name: en["write.empty.start"] }).click();

    await expect(page).toHaveURL(/\/write\/pages\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: en["write.editor.title"] })).toBeVisible();
  });

  test("chapters and pages are created, renamed and moved, and stay that way after a reload (AC-2, AC-3)", async ({
    page,
  }) => {
    await page.goto("/write");
    await expect(chapterHeadings(page)).toHaveText([en["write.firstChapterTitle"]]);
    const firstPages = page.getByRole("list", { name: `Pages in ${en["write.firstChapterTitle"]}` });
    await expect(firstPages.getByText(en["write.untitledPage"])).toBeVisible();
    await expect(firstPages.getByText(en["write.status.draft"], { exact: true })).toBeVisible();

    await page.getByLabel(en["write.newChapter.label"]).fill("Second");
    await page.getByRole("button", { name: en["write.newChapter.submit"] }).click();
    await expect(chapterHeadings(page)).toHaveText([en["write.firstChapterTitle"], "Second"]);
    await expect(page.getByLabel(en["write.newChapter.label"])).toHaveValue("");

    await page.getByRole("button", { name: "Add page: Second" }).click();
    await page.getByRole("button", { name: "Add page: Second" }).click();
    const secondPages = page.getByRole("list", { name: "Pages in Second" });
    await expect(secondPages.getByRole("listitem")).toHaveCount(2);

    await secondPages.getByRole("button", { name: "Rename: Untitled page" }).first().click();
    await page.getByLabel(en["write.field.pageTitle"], { exact: true }).fill("Evening");
    await page.getByRole("button", { name: en["write.action.save"] }).click();
    await expect(secondPages.getByRole("listitem").first()).toContainText("Evening");
    await expect(secondPages.getByRole("button", { name: "Rename: Evening" })).toBeFocused();

    await secondPages.getByRole("button", { name: "Move down: Evening" }).click();
    await expect(secondPages.getByRole("listitem").last()).toContainText("Evening");
    // It reached the bottom, so focus moves to its Move up.
    await expect(secondPages.getByRole("button", { name: "Move up: Evening" })).toBeFocused();

    await page.getByRole("button", { name: "Rename: Second" }).click();
    await page.getByLabel(en["write.field.chapterTitle"], { exact: true }).fill("दूसरा");
    await page.getByRole("button", { name: en["write.action.save"] }).click();
    await expect(chapterHeadings(page)).toHaveText([en["write.firstChapterTitle"], "दूसरा"]);

    await page.getByRole("button", { name: "Move up: दूसरा" }).click();
    await expect(chapterHeadings(page)).toHaveText(["दूसरा", en["write.firstChapterTitle"]]);

    await page.reload();
    await expect(chapterHeadings(page)).toHaveText(["दूसरा", en["write.firstChapterTitle"]]);
    await expect(page.getByRole("list", { name: "Pages in दूसरा" }).getByRole("listitem").last()).toContainText("Evening");
  });

  test("an empty rename shows an inline error and saves nothing (AC-4)", async ({ page }) => {
    await page.goto("/write");
    await page.getByRole("button", { name: `Rename: ${en["write.firstChapterTitle"]}` }).click();
    const input = page.getByLabel(en["write.field.chapterTitle"], { exact: true });
    await input.fill("   ");
    await page.getByRole("button", { name: en["write.action.save"] }).click();

    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(en["write.error.titleEmpty"]);

    await page.reload();
    await expect(chapterHeadings(page)).toHaveText(["दूसरा", en["write.firstChapterTitle"]]);
  });

  test("keyboard only: a move keeps focus on the item and announces its new place (AC-5)", async ({ page }) => {
    await page.goto("/write");
    const moveDown = page.getByRole("button", { name: "Move down: दूसरा" });

    await tabTo(page, moveDown);
    expect(await moveDown.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("status")).toHaveText("Moved दूसरा to position 2 of 2");
    await expect(chapterHeadings(page)).toHaveText([en["write.firstChapterTitle"], "दूसरा"]);
    // It reached the bottom, so its Move down is disabled and focus moves to its Move up.
    await expect(page.getByRole("button", { name: "Move up: दूसरा" })).toBeFocused();
  });

  test("a failed save shows a non-blocking notice, keeps the last saved order, and Retry applies it (AC-8)", async ({
    page,
  }) => {
    await page.goto("/write");
    const saved = [en["write.firstChapterTitle"], "दूसरा"];
    await expect(chapterHeadings(page)).toHaveText(saved);

    // Server Actions POST to the page they run on; drop them as a lost connection would.
    const dropActions = (route: Route) => (route.request().method() === "POST" ? route.abort() : route.fallback());
    await page.route("**/write", dropActions);
    await page.getByRole("button", { name: "Move up: दूसरा" }).click();

    const notice = page.getByRole("alert").filter({ hasText: en["write.error.saveFailed"] });
    const retry = page.getByRole("button", { name: en["write.error.retry"] });
    await expect(notice).toBeVisible();
    await expect(retry).toBeVisible();
    await expect(chapterHeadings(page)).toHaveText(saved);
    // Not a dialog: the rest of the dashboard stays usable.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel(en["write.newChapter.label"])).toBeEditable();

    await page.unroute("**/write", dropActions);
    await retry.click();

    await expect(chapterHeadings(page)).toHaveText(["दूसरा", en["write.firstChapterTitle"]]);
    await expect(notice).toHaveCount(0);
    await expect(retry).toHaveCount(0);

    await page.reload();
    await expect(chapterHeadings(page)).toHaveText(["दूसरा", en["write.firstChapterTitle"]]);
  });

  test("in Hindi, the chrome is Hindi and Devanagari titles use the Devanagari font (AC-6)", async ({ page }) => {
    await page.goto("/write");
    await page.getByRole("button", { name: "हिन्दी" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(hi["write.title"]);
    await expect(page.getByRole("button", { name: `नाम बदलें: ${en["write.firstChapterTitle"]}` })).toBeVisible();
    await expect(page.getByRole("button", { name: hi["write.newChapter.submit"] })).toBeVisible();

    const heading = chapterHeadings(page).filter({ hasText: "दूसरा" });
    await expect(heading).toHaveAttribute("lang", "hi");
    const fonts = await heading.evaluate((element) => {
      const firstFamily = (stack: string) => stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
      return {
        heading: firstFamily(getComputedStyle(element).fontFamily),
        devanagari: firstFamily(getComputedStyle(document.documentElement).getPropertyValue("--font-face-devanagari")),
      };
    });
    expect(fonts.devanagari).not.toBe("");
    expect(fonts.heading).toBe(fonts.devanagari);
  });
});
