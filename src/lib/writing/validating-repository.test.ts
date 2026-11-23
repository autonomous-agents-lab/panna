import { describe, expect, it, vi } from "vitest";

import type { CurrentWriter, WritingRepository } from "@/contracts";
import { everyNode, options } from "@/contracts/page-body/__fixtures__/documents";

import { withValidation } from "./validating-repository";

const ID = "4f0c9a3e-8a7b-4c39-9b1e-2d8f6a5c7e10";
const OTHER_ID = "7b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
const WRITER: CurrentWriter = { userId: ID, bookId: OTHER_ID };
const DONE = { ok: true, value: "done" };

type Method = keyof WritingRepository;

function spyRepository() {
  const methods: Method[] = [
    "listChapters",
    "createChapter",
    "renameChapter",
    "reorderChapters",
    "createPage",
    "renamePage",
    "reorderPages",
    "getPageForEdit",
    "savePageContent",
    "setPageLanguage",
    "publishPage",
    "unpublishPage",
    "archivePage",
    "restorePage",
  ];
  const spies = Object.fromEntries(methods.map((method) => [method, vi.fn(async () => DONE)]));
  return { inner: spies as unknown as WritingRepository, spies };
}

/** Calls `method` with input the type system would refuse, as a client could send it. */
function call(repository: WritingRepository, method: Exclude<Method, "listChapters">, input: unknown) {
  const untyped = repository[method] as (writer: CurrentWriter, input: unknown) => Promise<unknown>;
  return untyped(WRITER, input);
}

describe("withValidation: invalid input (AC-4)", () => {
  it.each<[string, Exclude<Method, "listChapters">, unknown]>([
    ["an empty chapter title", "createChapter", { title: "", language: "en" }],
    ["a whitespace-only chapter title", "renameChapter", { chapterId: ID, title: "  \t " }],
    ["a 101-character chapter title", "createChapter", { title: "a".repeat(101), language: "hi" }],
    ["a 101-character page title", "renamePage", { pageId: ID, title: "क".repeat(101) }],
    ["an empty page title", "createPage", { chapterId: ID, language: "en", title: "  " }],
    ["an empty first chapter title", "createPage", { firstChapterTitle: "", language: "en" }],
    ["an unknown language code", "createChapter", { title: "Bonjour", language: "fr" }],
    ["an unknown page language", "setPageLanguage", { pageId: ID, language: "fr" }],
    ["a body that isn't a document", "savePageContent", { pageId: ID, body: { type: "paragraph" } }],
    ["a body that isn't an object", "savePageContent", { pageId: ID, body: "<p>hi</p>" }],
    ["a missing body", "savePageContent", { pageId: ID }],
    ["a non-uuid page id", "publishPage", { pageId: "1" }],
    ["a non-uuid chapter id", "reorderPages", { chapterId: "x", pageIds: [ID] }],
    ["a repeated id in an order", "reorderChapters", { chapterIds: [ID, ID] }],
    ["an empty order", "reorderPages", { chapterId: ID, pageIds: [] }],
    ["a page with neither chapterId nor firstChapterTitle", "createPage", { language: "en" }],
    ["an unknown key", "archivePage", { pageId: ID, archived_at: "2026-11-23T10:00:00Z" }],
    ["no input at all", "restorePage", undefined],
    ["a missing page id", "unpublishPage", {}],
    ["a missing page id", "getPageForEdit", {}],
  ])("rejects %s for %s without calling the repository", async (_, method, input) => {
    const { inner, spies } = spyRepository();

    const result = await call(withValidation(inner, options), method, input);

    expect(result).toEqual({ ok: false, error: "invalid_input", issues: expect.any(Array) });
    const { issues } = result as { issues: { code: string; path: unknown[]; message: string }[] };
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) expect(issue).toEqual(expect.objectContaining({ code: expect.any(String), path: expect.any(Array) }));
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
  });

  it("reports the sanitiser's error code for a body it rejects", async () => {
    const { inner } = spyRepository();
    const body = { type: "doc", content: [{ type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } }] };
    const result = await call(withValidation(inner, options), "savePageContent", { pageId: ID, body });
    expect(result).toMatchObject({
      error: "invalid_input",
      issues: [{ message: "page_body_image_src_not_allowed", path: ["body", "content", 0, "attrs", "src"] }],
    });
  });
});

describe("withValidation: valid input", () => {
  it.each<[Exclude<Method, "listChapters">, unknown, unknown]>([
    ["createChapter", { title: " One ", language: "en" }, { title: "One", language: "en" }],
    ["renameChapter", { chapterId: ID, title: "दो" }, { chapterId: ID, title: "दो" }],
    ["reorderChapters", { chapterIds: [OTHER_ID, ID] }, { chapterIds: [OTHER_ID, ID] }],
    ["createPage", { chapterId: ID, language: "hi" }, { chapterId: ID, language: "hi" }],
    ["createPage", { firstChapterTitle: "पहला", language: "hi" }, { firstChapterTitle: "पहला", language: "hi" }],
    ["renamePage", { pageId: ID, title: null }, { pageId: ID, title: null }],
    ["reorderPages", { chapterId: ID, pageIds: [OTHER_ID] }, { chapterId: ID, pageIds: [OTHER_ID] }],
    ["getPageForEdit", { pageId: ID }, { pageId: ID }],
    ["setPageLanguage", { pageId: ID, language: "en" }, { pageId: ID, language: "en" }],
    ["publishPage", { pageId: ID }, { pageId: ID }],
    ["unpublishPage", { pageId: ID }, { pageId: ID }],
    ["archivePage", { pageId: ID }, { pageId: ID }],
    ["restorePage", { pageId: ID }, { pageId: ID }],
  ])("passes %s the parsed input and returns its result", async (method, input, parsed) => {
    const { inner, spies } = spyRepository();

    expect(await call(withValidation(inner, options), method, input)).toEqual(DONE);
    expect(spies[method]).toHaveBeenCalledExactlyOnceWith(WRITER, parsed);
  });

  it("passes savePageContent the sanitised body", async () => {
    const { inner, spies } = spyRepository();
    const body = { ...everyNode, content: [{ type: "script", content: [] }, ...everyNode.content] };

    await call(withValidation(inner, options), "savePageContent", { pageId: ID, body });

    expect(spies.savePageContent).toHaveBeenCalledExactlyOnceWith(WRITER, { pageId: ID, body: everyNode });
  });

  it("passes listChapters straight through: it has no input", async () => {
    const { inner, spies } = spyRepository();
    expect(await withValidation(inner, options).listChapters(WRITER)).toEqual(DONE);
    expect(spies.listChapters).toHaveBeenCalledExactlyOnceWith(WRITER);
  });
});
