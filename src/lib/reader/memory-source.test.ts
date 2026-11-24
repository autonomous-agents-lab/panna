import { describe, expect, it } from "vitest";

import { SAMPLE_IDS, SAMPLE_USERNAMES, sampleBookStore } from "./fixtures";
import { createMemoryBookSource } from "./memory-source";
import { toReaderBook, toReaderPage } from "./project";

const source = createMemoryBookSource(sampleBookStore);

describe("createMemoryBookSource", () => {
  it("resolves a writer's published book", async () => {
    await expect(source.getPublishedBook(SAMPLE_USERNAMES.bilingual)).resolves.toEqual(
      toReaderBook(sampleBookStore, SAMPLE_USERNAMES.bilingual),
    );
  });

  it("resolves one published page", async () => {
    const pageId = SAMPLE_IDS.bilingual.pages.morningHindi;
    await expect(source.getPublishedPage(SAMPLE_USERNAMES.bilingual, pageId)).resolves.toEqual(
      toReaderPage(sampleBookStore, SAMPLE_USERNAMES.bilingual, pageId),
    );
  });

  it("resolves null when nothing matches", async () => {
    await expect(source.getPublishedBook("nobody_here")).resolves.toBeNull();
    await expect(source.getPublishedPage(SAMPLE_USERNAMES.drafts, SAMPLE_IDS.drafts.pages.draft)).resolves.toBeNull();
  });
});
