import { describe, expect, it, vi } from "vitest";

import { TEXT_LIMITS } from "@/config/books";
import { PAGE_TITLE_LIMIT } from "@/config/writing";
import { options } from "@/contracts/page-body/__fixtures__/documents";
import type { ChapterWithPages, CurrentWriter, WritingRepository } from "@/contracts";
import { catalogues, translatorFor } from "@/i18n/catalogue";

import { createInMemoryWritingRepository } from "../in-memory-repository";
import { editorPath } from "../routes";
import { STAND_IN_WRITER } from "../stand-in-writer";
import { withValidation } from "../validating-repository";
import { IDLE } from "./action-state";
import { createDashboardActions } from "./actions";

class Redirected extends Error {}

const STRANGER: CurrentWriter = {
  userId: "00000000-0000-4000-8000-0000000000aa",
  bookId: "00000000-0000-4000-8000-0000000000bb",
};
const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000ff";

function setup({
  locale = "en",
  writer = STAND_IN_WRITER,
  change = (repository: WritingRepository) => repository,
}: {
  locale?: "en" | "hi";
  writer?: CurrentWriter | null | (() => Promise<CurrentWriter | null>);
  change?: (repository: WritingRepository) => WritingRepository;
} = {}) {
  const store = withValidation(
    createInMemoryWritingRepository({ books: [{ id: STAND_IN_WRITER.bookId, userId: STAND_IN_WRITER.userId }] }),
    options,
  );
  const revalidate = vi.fn();
  const redirect = vi.fn((url: string): never => {
    throw new Redirected(url);
  });
  const actions = createDashboardActions({
    services: {
      repository: change(store),
      getCurrentWriter: typeof writer === "function" ? writer : async () => writer,
    },
    revalidate,
    redirect,
    t: translatorFor(locale),
    language: locale,
  });
  const list = async (): Promise<ChapterWithPages[]> => {
    const result = await store.listChapters(STAND_IN_WRITER);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  return { actions, store, revalidate, redirect, list, catalogue: catalogues[locale] };
}

function form(fields: Record<string, string> = {}): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

/** A book with chapters "One" (pages A, B, C) and "Two" (no pages). */
async function seeded(options: Parameters<typeof setup>[0] = {}) {
  const context = setup(options);
  const { store } = context;
  const one = await store.createChapter(STAND_IN_WRITER, { title: "One", language: "en" });
  const two = await store.createChapter(STAND_IN_WRITER, { title: "Two", language: "en" });
  if (!one.ok || !two.ok) throw new Error("seeding failed");
  const pages = [];
  for (const title of ["A", "B", "C"]) {
    const page = await store.createPage(STAND_IN_WRITER, { chapterId: one.value.id, language: "en", title });
    if (!page.ok) throw new Error("seeding failed");
    pages.push(page.value.id);
  }
  return { ...context, one: one.value.id, two: two.value.id, pages: pages as [string, string, string] };
}

const SAVE_FAILED = { status: "failed", message: catalogues.en["write.error.saveFailed"] };

describe("startWriting (AC-1)", () => {
  it.each(["en", "hi"] as const)(
    "in %s, creates a first chapter with a translated title and a draft page, then opens it in the editor",
    async (locale) => {
      const { actions, list, revalidate, redirect, catalogue } = setup({ locale });

      await expect(actions.startWriting(IDLE, form())).rejects.toThrow(Redirected);

      const chapters = await list();
      expect(chapters).toHaveLength(1);
      expect(chapters[0]).toMatchObject({ title: catalogue["write.firstChapterTitle"], language: locale });
      expect(chapters[0]?.pages).toEqual([expect.objectContaining({ status: "draft", title: null, language: locale })]);
      expect(revalidate).toHaveBeenCalledWith("/write");
      expect(redirect).toHaveBeenCalledWith(editorPath(chapters[0]!.pages[0]!.id));
    },
  );
});

describe("creating, renaming and moving (AC-3)", () => {
  it("creates a chapter at the end, announces it and revalidates /write", async () => {
    const { actions, list, revalidate } = await seeded();

    const state = await actions.createChapter(IDLE, form({ title: "  Three  " }));

    expect(state).toEqual({ status: "ok", announcement: "Added chapter Three" });
    expect((await list()).map((chapter) => chapter.title)).toEqual(["One", "Two", "Three"]);
    expect(revalidate).toHaveBeenCalledExactlyOnceWith("/write");
  });

  it("creates an untitled draft page at the end of the chapter, in the UI language, staying on the dashboard", async () => {
    const { actions, list, revalidate, redirect, one } = await seeded({ locale: "hi" });

    const state = await actions.createPage(IDLE, form({ chapterId: one }));

    expect(state).toEqual({ status: "ok", announcement: "One में एक बिना शीर्षक का पन्ना जोड़ा गया" });
    const pages = (await list())[0]!.pages;
    expect(pages.map((page) => page.title)).toEqual(["A", "B", "C", null]);
    expect(pages[3]).toMatchObject({ status: "draft", language: "hi" });
    expect(revalidate).toHaveBeenCalledWith("/write");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("renames a chapter", async () => {
    const { actions, list, revalidate, two } = await seeded();

    const state = await actions.renameChapter(IDLE, form({ chapterId: two, title: " दूसरा " }));

    expect(state).toEqual({ status: "ok", announcement: "Renamed to दूसरा" });
    expect((await list())[1]?.title).toBe("दूसरा");
    expect(revalidate).toHaveBeenCalledWith("/write");
  });

  it("renames a page", async () => {
    const { actions, list, revalidate, pages } = await seeded();

    const state = await actions.renamePage(IDLE, form({ pageId: pages[1], title: "Bee" }));

    expect(state).toEqual({ status: "ok", announcement: "Renamed to Bee" });
    expect((await list())[0]?.pages.map((page) => page.title)).toEqual(["A", "Bee", "C"]);
    expect(revalidate).toHaveBeenCalledWith("/write");
  });

  it.each([
    ["down", "One", ["Two", "One"], 2],
    ["up", "Two", ["Two", "One"], 1],
  ] as const)("moves a chapter %s and announces its new position", async (direction, title, order, position) => {
    const context = await seeded();
    const chapterId = title === "One" ? context.one : context.two;

    const state = await context.actions.moveChapter(IDLE, form({ chapterId, direction }));

    expect(state).toEqual({
      status: "ok",
      announcement: `Moved ${title} to position ${position} of 2`,
      moved: { direction, position, count: 2 },
    });
    expect((await context.list()).map((chapter) => chapter.title)).toEqual(order);
    expect(context.revalidate).toHaveBeenCalledWith("/write");
  });

  it.each([
    ["up", 2, ["A", "C", "B"], 2],
    ["down", 0, ["B", "A", "C"], 2],
  ] as const)("moves a page %s among the listed pages, keeping archived pages", async (direction, index, order, position) => {
    const { actions, store, list, pages } = await seeded();
    const archived = await store.createPage(STAND_IN_WRITER, { chapterId: (await list())[0]!.id, language: "en", title: "X" });
    if (!archived.ok) throw new Error("seeding failed");
    await store.archivePage(STAND_IN_WRITER, { pageId: archived.value.id });

    const state = await actions.movePage(IDLE, form({ pageId: pages[index], direction }));

    expect(state).toMatchObject({ status: "ok", moved: { direction, position, count: 3 } });
    expect((await list())[0]?.pages.map((page) => [page.title, page.status === "archived"])).toEqual([
      ...order.map((title) => [title, false]),
      ["X", true],
    ]);
  });

  it("announces an untitled page by its placeholder", async () => {
    const { actions, store, pages } = await seeded({ locale: "hi" });
    await store.renamePage(STAND_IN_WRITER, { pageId: pages[0], title: null });

    const state = await actions.movePage(IDLE, form({ pageId: pages[0], direction: "down" }));

    expect(state).toMatchObject({ status: "ok", announcement: "बिना शीर्षक का पन्ना अब 3 में से 2 स्थान पर है" });
  });
});

describe("invalid titles (AC-4)", () => {
  const tooLongChapter = "क".repeat(TEXT_LIMITS.chapterTitle.max + 1);
  const tooLongPage = "a".repeat(PAGE_TITLE_LIMIT.max + 1);

  it.each(["en", "hi"] as const)("in %s, shows the empty-title error and saves nothing", async (locale) => {
    const { actions, list, revalidate, two, pages, catalogue } = await seeded({ locale });
    const before = await list();
    const error = { status: "fieldError", message: catalogue["write.error.titleEmpty"] };

    expect(await actions.createChapter(IDLE, form({ title: "" }))).toEqual(error);
    expect(await actions.renameChapter(IDLE, form({ chapterId: two, title: "   " }))).toEqual(error);
    expect(await actions.renamePage(IDLE, form({ pageId: pages[0], title: "\n" }))).toEqual(error);

    expect(await list()).toEqual(before);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it.each(["en", "hi"] as const)("in %s, shows the too-long error with the limit and saves nothing", async (locale) => {
    const { actions, list, revalidate, two, pages } = await seeded({ locale });
    const before = await list();
    const t = translatorFor(locale);

    expect(await actions.createChapter(IDLE, form({ title: tooLongChapter }))).toEqual({
      status: "fieldError",
      message: t("write.error.titleTooLong", { max: TEXT_LIMITS.chapterTitle.max }),
    });
    expect(await actions.renameChapter(IDLE, form({ chapterId: two, title: tooLongChapter }))).toMatchObject({
      status: "fieldError",
    });
    expect(await actions.renamePage(IDLE, form({ pageId: pages[0], title: tooLongPage }))).toEqual({
      status: "fieldError",
      message: t("write.error.titleTooLong", { max: PAGE_TITLE_LIMIT.max }),
    });

    expect(await list()).toEqual(before);
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("a signed-out visitor (AC-7)", () => {
  it("is sent to sign in by every action, and nothing is saved", async () => {
    const { actions, list, revalidate } = setup({ writer: null });

    for (const [name, fields] of [
      ["startWriting", {}],
      ["createChapter", { title: "One" }],
      ["createPage", { chapterId: UNKNOWN_ID }],
      ["renameChapter", { chapterId: UNKNOWN_ID, title: "One" }],
      ["renamePage", { pageId: UNKNOWN_ID, title: "One" }],
      ["moveChapter", { chapterId: UNKNOWN_ID, direction: "up" }],
      ["movePage", { pageId: UNKNOWN_ID, direction: "up" }],
    ] as const) {
      await expect(actions[name](IDLE, form(fields)), name).rejects.toThrow(new Redirected("/login?next=%2Fwrite"));
    }
    expect(await list()).toEqual([]);
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("failures (AC-8)", () => {
  async function expectFailedAndUnchanged(
    context: Awaited<ReturnType<typeof seeded>>,
    run: () => Promise<unknown>,
  ) {
    const before = await context.list();
    expect(await run()).toEqual(SAVE_FAILED);
    expect(await context.list()).toEqual(before);
    expect(context.revalidate).not.toHaveBeenCalled();
    expect(context.redirect).not.toHaveBeenCalled();
  }

  it("fails when the repository throws, without an error page or a revalidate", async () => {
    const context = await seeded({
      change: (repository) => ({
        ...repository,
        renameChapter: async () => {
          throw new Error("connection reset");
        },
        listChapters: async () => {
          throw new Error("connection reset");
        },
      }),
    });

    await expectFailedAndUnchanged(context, () =>
      context.actions.renameChapter(IDLE, form({ chapterId: context.one, title: "New" })),
    );
    await expectFailedAndUnchanged(context, () =>
      context.actions.moveChapter(IDLE, form({ chapterId: context.one, direction: "down" })),
    );
  });

  it("fails when resolving the writer throws", async () => {
    const context = await seeded({
      writer: async () => {
        throw new Error("auth down");
      },
    });
    await expectFailedAndUnchanged(context, () => context.actions.createChapter(IDLE, form({ title: "New" })));
  });

  it("fails when the writer's book can't be listed", async () => {
    const context = await seeded({ writer: STRANGER });
    await expectFailedAndUnchanged(context, () => context.actions.createPage(IDLE, form({ chapterId: context.one })));
    await expectFailedAndUnchanged(context, () =>
      context.actions.moveChapter(IDLE, form({ chapterId: context.one, direction: "down" })),
    );
    await expectFailedAndUnchanged(context, () =>
      context.actions.movePage(IDLE, form({ pageId: context.pages[0], direction: "down" })),
    );
    await expectFailedAndUnchanged(context, () => context.actions.startWriting(IDLE, form()));
  });

  it("fails for ids that no longer exist or aren't the writer's", async () => {
    const context = await seeded();
    const { actions } = context;
    await expectFailedAndUnchanged(context, () => actions.createPage(IDLE, form({ chapterId: UNKNOWN_ID })));
    await expectFailedAndUnchanged(context, () =>
      actions.renameChapter(IDLE, form({ chapterId: UNKNOWN_ID, title: "New" })),
    );
    await expectFailedAndUnchanged(context, () => actions.renamePage(IDLE, form({ pageId: "not-a-uuid", title: "New" })));
    await expectFailedAndUnchanged(context, () =>
      actions.moveChapter(IDLE, form({ chapterId: UNKNOWN_ID, direction: "up" })),
    );
    await expectFailedAndUnchanged(context, () => actions.movePage(IDLE, form({ pageId: UNKNOWN_ID, direction: "up" })));
  });

  it("fails for a move past either end, or of an archived page", async () => {
    const context = await seeded();
    const { actions, store, one, pages } = context;
    await expectFailedAndUnchanged(context, () => actions.moveChapter(IDLE, form({ chapterId: one, direction: "up" })));
    await expectFailedAndUnchanged(context, () => actions.movePage(IDLE, form({ pageId: pages[2], direction: "down" })));
    await store.archivePage(STAND_IN_WRITER, { pageId: pages[1] });
    await expectFailedAndUnchanged(context, () => actions.movePage(IDLE, form({ pageId: pages[1], direction: "up" })));
    await expectFailedAndUnchanged(context, () => actions.renamePage(IDLE, form({ pageId: pages[1], title: "New" })));
  });

  it("fails when the repository refuses the new order", async () => {
    const context = await seeded({
      change: (repository) => ({
        ...repository,
        reorderChapters: async () => ({ ok: false, error: "invalid_order" }),
        reorderPages: async () => ({ ok: false, error: "invalid_order" }),
      }),
    });
    await expectFailedAndUnchanged(context, () =>
      context.actions.moveChapter(IDLE, form({ chapterId: context.one, direction: "down" })),
    );
    await expectFailedAndUnchanged(context, () =>
      context.actions.movePage(IDLE, form({ pageId: context.pages[0], direction: "down" })),
    );
  });

  it("fails for a form that isn't the dashboard's", async () => {
    const context = await seeded();
    const file = new FormData();
    file.set("title", new Blob(["x"]));
    await expectFailedAndUnchanged(context, () => context.actions.createChapter(IDLE, file));
    await expectFailedAndUnchanged(context, () => context.actions.renameChapter(IDLE, form({ title: "New" })));
    await expectFailedAndUnchanged(context, () =>
      context.actions.moveChapter(IDLE, form({ chapterId: context.two, direction: "sideways" })),
    );
  });

  it("says so in the UI language", async () => {
    const context = await seeded({ locale: "hi", writer: STRANGER });
    expect(await context.actions.createPage(IDLE, form({ chapterId: context.one }))).toEqual({
      status: "failed",
      message: catalogues.hi["write.error.saveFailed"],
    });
  });
});
