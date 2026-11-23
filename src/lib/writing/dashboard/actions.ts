import { z } from "zod";

import { TEXT_LIMITS, type TextLimit } from "@/config/books";
import { PAGE_TITLE_LIMIT } from "@/config/writing";
import type { ChapterWithPages, CurrentWriter, Language, PageSummary, WritingResult } from "@/contracts";
import type { Translate } from "@/i18n";

import type { WritingServices } from "../index";
import { signInPath } from "../require-writer";
import { WRITE_PATH, editorPath } from "../routes";
import type { ActionState, DashboardAction } from "./action-state";
import { MOVE_DIRECTIONS, moveId, pageOrderAfterMove, type Move, type MoveDirection } from "./move";
import { validateTitle } from "./title";

export interface DashboardActionDeps {
  services: WritingServices;
  revalidate: (path: string) => void;
  redirect: (url: string) => never;
  /** Translates into the request's UI language. */
  t: Translate;
  /** The language new chapters and pages are written in: the UI language, until the contract exposes the book's. */
  language: Language;
}

/** What a change came to, and where to go next if anywhere. */
interface Done {
  state: ActionState;
  redirectTo?: string;
}

const direction = z.enum(MOVE_DIRECTIONS);

// Only shapes here: the repository validates ids and titles against the contract.
const forms = {
  startWriting: z.object({}),
  createChapter: z.object({ title: z.string() }),
  createPage: z.object({ chapterId: z.string() }),
  renameChapter: z.object({ chapterId: z.string(), title: z.string() }),
  renamePage: z.object({ pageId: z.string(), title: z.string() }),
  moveChapter: z.object({ chapterId: z.string(), direction }),
  movePage: z.object({ pageId: z.string(), direction }),
};

function findPage(chapters: readonly ChapterWithPages[], pageId: string) {
  for (const chapter of chapters) {
    const page = chapter.pages.find((candidate) => candidate.id === pageId);
    if (page) return { chapter, page };
  }
  return undefined;
}

/**
 * The dashboard's Server Actions. Each one resolves the writer again (it never trusts the
 * client), checks the form, calls the repository and maps the result to an ActionState. Only a
 * change that saved revalidates /write, so after a failure the list still shows the last saved
 * state. Thrown infrastructure errors become `failed`, never an error page.
 */
export function createDashboardActions({
  services: { repository, getCurrentWriter },
  revalidate,
  redirect,
  t,
  language,
}: DashboardActionDeps) {
  const failed: Done = { state: { status: "failed", message: t("write.error.saveFailed") } };
  const ok = (announcement?: string, extra: Partial<Extract<ActionState, { status: "ok" }>> = {}): Done => ({
    state: { status: "ok", announcement, ...extra },
  });

  const settle = <T>(result: WritingResult<T>, onOk: (value: T) => Done): Done =>
    result.ok ? onOk(result.value) : failed;

  const titleError = (error: "empty" | "too_long", limit: TextLimit): Done => ({
    state: {
      status: "fieldError",
      message: error === "empty" ? t("write.error.titleEmpty") : t("write.error.titleTooLong", { max: limit.max }),
    },
  });

  const moved = (title: string, towards: MoveDirection, { position, count }: Move): Done =>
    ok(t("write.announce.moved", { title, position, count }), { moved: { direction: towards, position, count } });

  const pageTitle = (page: PageSummary) => page.title ?? t("write.untitledPage");

  async function withChapters(writer: CurrentWriter, change: (chapters: ChapterWithPages[]) => Promise<Done>) {
    const chapters = await repository.listChapters(writer);
    return chapters.ok ? change(chapters.value) : failed;
  }

  function action<Input>(
    form: z.ZodType<Input>,
    change: (writer: CurrentWriter, input: Input) => Promise<Done>,
  ): DashboardAction {
    return async (_state, formData) => {
      const input = form.safeParse(Object.fromEntries(formData));
      if (!input.success) return failed.state;
      let done: Done | null;
      try {
        const writer = await getCurrentWriter();
        done = writer && (await change(writer, input.data));
      } catch {
        return failed.state;
      }
      // Outside the try, so the redirects Next throws are not caught as failures.
      if (!done) return redirect(signInPath(WRITE_PATH));
      if (done.state.status === "ok") revalidate(WRITE_PATH);
      if (done.redirectTo) redirect(done.redirectTo);
      return done.state;
    };
  }

  return {
    /** The empty state's first page: a first chapter with a translated title, then the editor. */
    startWriting: action(forms.startWriting, async (writer) =>
      settle(
        await repository.createPage(writer, { firstChapterTitle: t("write.firstChapterTitle"), language }),
        (page) => ({ ...ok(), redirectTo: editorPath(page.id) }),
      ),
    ),

    createChapter: action(forms.createChapter, async (writer, { title }) => {
      const checked = validateTitle(title, TEXT_LIMITS.chapterTitle);
      if (!checked.ok) return titleError(checked.error, TEXT_LIMITS.chapterTitle);
      return settle(await repository.createChapter(writer, { title: checked.title, language }), (chapter) =>
        ok(t("write.announce.chapterAdded", { title: chapter.title })),
      );
    }),

    /** An untitled draft at the end of the chapter; the writer stays on the dashboard. */
    createPage: action(forms.createPage, (writer, { chapterId }) =>
      withChapters(writer, async (chapters) => {
        const chapter = chapters.find((candidate) => candidate.id === chapterId);
        if (!chapter) return failed;
        return settle(await repository.createPage(writer, { chapterId, language }), () =>
          ok(t("write.announce.pageAdded", { title: chapter.title })),
        );
      }),
    ),

    renameChapter: action(forms.renameChapter, async (writer, { chapterId, title }) => {
      const checked = validateTitle(title, TEXT_LIMITS.chapterTitle);
      if (!checked.ok) return titleError(checked.error, TEXT_LIMITS.chapterTitle);
      return settle(await repository.renameChapter(writer, { chapterId, title: checked.title }), (chapter) =>
        ok(t("write.announce.renamed", { title: chapter.title })),
      );
    }),

    renamePage: action(forms.renamePage, async (writer, { pageId, title }) => {
      const checked = validateTitle(title, PAGE_TITLE_LIMIT);
      if (!checked.ok) return titleError(checked.error, PAGE_TITLE_LIMIT);
      return settle(await repository.renamePage(writer, { pageId, title: checked.title }), () =>
        ok(t("write.announce.renamed", { title: checked.title })),
      );
    }),

    moveChapter: action(forms.moveChapter, (writer, { chapterId, direction: towards }) =>
      withChapters(writer, async (chapters) => {
        const chapter = chapters.find((candidate) => candidate.id === chapterId);
        if (!chapter) return failed;
        const move = moveId(
          chapters.map((candidate) => candidate.id),
          chapterId,
          towards,
        );
        if (!move) return failed;
        return settle(await repository.reorderChapters(writer, { chapterIds: move.ids }), () =>
          moved(chapter.title, towards, move),
        );
      }),
    ),

    /** Among the chapter's pages that aren't archived; archived ones keep their places. */
    movePage: action(forms.movePage, (writer, { pageId, direction: towards }) =>
      withChapters(writer, async (chapters) => {
        const found = findPage(chapters, pageId);
        if (!found) return failed;
        const move = pageOrderAfterMove(found.chapter.pages, pageId, towards);
        if (!move) return failed;
        return settle(
          await repository.reorderPages(writer, { chapterId: found.chapter.id, pageIds: move.ids }),
          () => moved(pageTitle(found.page), towards, move),
        );
      }),
    ),
  };
}

export type DashboardActions = ReturnType<typeof createDashboardActions>;
