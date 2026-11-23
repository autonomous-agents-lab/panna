import type { Browser } from "@playwright/test";

import { richTextPlainText, type RichTextBlock } from "../src/contracts";
import { loadConfig } from "../src/config/schema";
import { HIDDEN_MARKERS, SAMPLE_IDS, SAMPLE_USERNAMES, sampleBookStore } from "../src/lib/reader/fixtures";
import { toReaderBook, toReaderPage } from "../src/lib/reader/project";
import { en } from "../src/i18n/messages/en";
import { hi } from "../src/i18n/messages/hi";

import { expect, test } from "./fixtures";

// The reader serves the sample books until it reads from Supabase, so these run against any
// target, including a Deploy Preview.

const { appName } = loadConfig(process.env);
const bilingualBook = toReaderBook(sampleBookStore, SAMPLE_USERNAMES.bilingual)!;
const { bilingual, drafts } = SAMPLE_IDS;

/** Runs of page text long enough not to match by accident. */
function textRuns(blocks: readonly RichTextBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "blockquote"
      ? textRuns(block.content)
      : (block.content ?? []).flatMap((node) => (node.type === "text" && node.text.trim().length >= 5 ? [node.text] : [])),
  );
}

async function withoutJavaScript(browser: Browser, baseURL: string | undefined, locale = "en-US") {
  const context = await browser.newContext({ javaScriptEnabled: false, locale, baseURL });
  return { context, page: await context.newPage() };
}

test.describe("the book route with JavaScript disabled", () => {
  test("serves the whole published book in chapter and page order (AC-2)", async ({ browser, baseURL, request }) => {
    const response = await request.get(`/${SAMPLE_USERNAMES.bilingual}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const texts = [
      bilingualBook.book.title,
      bilingualBook.writer.display_name,
      bilingualBook.writer.bio!,
      ...bilingualBook.chapters.flatMap((chapter) => [chapter.title, ...chapter.pages.flatMap((page) => textRuns(page.content.content))]),
    ];
    const positions = texts.map((text) => html.indexOf(text));
    expect(positions.filter((position) => position < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    const { context, page } = await withoutJavaScript(browser, baseURL);
    await page.goto(`/${SAMPLE_USERNAMES.bilingual}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(bilingualBook.book.title);
    await expect(main.getByRole("heading", { level: 2 })).toHaveText(bilingualBook.chapters.map((chapter) => chapter.title));
    await context.close();
  });

  test("marks each page with its own language (AC-3)", async ({ browser, baseURL }) => {
    const { context, page } = await withoutJavaScript(browser, baseURL);
    await page.goto(`/${SAMPLE_USERNAMES.bilingual}`);
    const [hindi, english] = bilingualBook.chapters[0]!.pages;
    await expect(page.locator('article[lang="hi"]').first()).toContainText(textRuns(hindi!.content.content)[0]!);
    await expect(page.locator('article[lang="en"]').first()).toContainText(textRuns(english!.content.content)[0]!);
    await expect(page.locator("article")).toHaveCount(5);
    await context.close();
  });

  test("shows no draft or archived text (AC-4)", async ({ request }) => {
    const response = await request.get(`/${SAMPLE_USERNAMES.drafts}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Sample published text from a book that also has drafts.");
    for (const marker of Object.values(HIDDEN_MARKERS)) expect(html).not.toContain(marker);
  });

  for (const { browserLocale, t } of [
    { browserLocale: "en-US", t: en },
    { browserLocale: "hi-IN", t: hi },
  ]) {
    test(`in ${browserLocale}, shows the cover and an empty state for a book with nothing published (AC-8)`, async ({
      browser,
      baseURL,
    }) => {
      const { context, page } = await withoutJavaScript(browser, baseURL, browserLocale);
      const response = await page.goto(`/${SAMPLE_USERNAMES.empty}`);
      expect(response?.status()).toBe(200);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText("An Empty Sample Book");
      await expect(main.getByText(t["reader.byline"].replace("{writerName}", "Sample Beginner"))).toBeVisible();
      await expect(main.getByText(t["reader.empty"])).toBeVisible();
      await context.close();
    });
  }

  test("titles the document with the book, the writer and the configured app name (AC-9)", async ({ browser, baseURL }) => {
    const { context, page } = await withoutJavaScript(browser, baseURL);
    await page.goto(`/${SAMPLE_USERNAMES.bilingual}`);
    await expect(page).toHaveTitle(`${bilingualBook.book.title} by ${bilingualBook.writer.display_name} · ${appName}`);
    await page.goto(`/${SAMPLE_USERNAMES.bilingual}/${bilingual.pages.rainEnglish}`);
    await expect(page).toHaveTitle(
      `${bilingualBook.chapters[1]!.title}: ${bilingualBook.book.title} by ${bilingualBook.writer.display_name} · ${appName}`,
    );
    await context.close();
  });
});

test.describe("a single page's route with JavaScript disabled", () => {
  test("serves the page's full text and its chapter title (AC-5)", async ({ browser, baseURL, request }) => {
    const view = toReaderPage(sampleBookStore, SAMPLE_USERNAMES.bilingual, bilingual.pages.morningHindi)!;
    const path = `/${SAMPLE_USERNAMES.bilingual}/${bilingual.pages.morningHindi}`;
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const paragraph of richTextPlainText(view.page.content).split("\n\n")) expect(html).toContain(paragraph);

    const { context, page } = await withoutJavaScript(browser, baseURL);
    await page.goto(path);
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(view.chapter.title);
    await expect(page.locator('article[lang="hi"]')).toHaveCount(1);
    await context.close();
  });
});

test.describe("missing books and pages are the localised 404 page", () => {
  const missing = [
    { what: "a username with no profile (AC-7)", path: "/nobody_here" },
    { what: "a draft page (AC-4)", path: `/${SAMPLE_USERNAMES.drafts}/${drafts.pages.draft}` },
    { what: "an archived page (AC-4)", path: `/${SAMPLE_USERNAMES.drafts}/${drafts.pages.archived}` },
    { what: "an unknown page id (AC-6)", path: `/${SAMPLE_USERNAMES.bilingual}/5d000000-0000-4000-8000-00000000ffff` },
    { what: "another writer's page (AC-6)", path: `/${SAMPLE_USERNAMES.drafts}/${bilingual.pages.rainEnglish}` },
    { what: "a malformed page id (AC-6)", path: `/${SAMPLE_USERNAMES.bilingual}/not-a-page` },
  ];

  // Next renders a route's notFound() as a 404 whose HTML is an empty shell; the browser then
  // draws the not-found page from the response's payload. So the status comes from the raw
  // response and the localised page from a browser.
  for (const { what, path } of missing) {
    test(`for ${what}`, async ({ browser, baseURL, request }) => {
      for (const [locale, t] of [
        ["en", en],
        ["hi", hi],
      ] as const) {
        const response = await request.get(path, { headers: { cookie: `locale=${locale}` } });
        expect(response.status()).toBe(404);
        const html = await response.text();
        for (const marker of Object.values(HIDDEN_MARKERS)) expect(html).not.toContain(marker);

        const context = await browser.newContext({ baseURL });
        await context.addCookies([{ name: "locale", value: locale, url: baseURL! }]);
        const page = await context.newPage();
        expect((await page.goto(path))?.status()).toBe(404);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(t["notFound.title"]);
        await context.close();
      }
    });
  }
});
