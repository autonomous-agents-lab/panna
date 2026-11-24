import { describe, expect, it } from "vitest";

import { SAMPLE_IDS, SAMPLE_USERNAMES } from "./fixtures";
import { loadPublishedBook, loadPublishedPage } from "./load";
import { getBookSource } from "./source";

describe("the reader's chosen source", () => {
  it("is the in-memory stand-in over the sample books, until the Supabase source lands", async () => {
    const book = await getBookSource().getPublishedBook(SAMPLE_USERNAMES.bilingual);
    expect(book?.book.id).toBe(SAMPLE_IDS.bilingual.book);
    expect(getBookSource()).toBe(getBookSource());
  });

  it("is what the loaders read through", async () => {
    await expect(loadPublishedBook(SAMPLE_USERNAMES.empty)).resolves.toEqual(
      await getBookSource().getPublishedBook(SAMPLE_USERNAMES.empty),
    );
    const pageId = SAMPLE_IDS.drafts.pages.published;
    await expect(loadPublishedPage(SAMPLE_USERNAMES.drafts, pageId)).resolves.toEqual(
      await getBookSource().getPublishedPage(SAMPLE_USERNAMES.drafts, pageId),
    );
  });
});
