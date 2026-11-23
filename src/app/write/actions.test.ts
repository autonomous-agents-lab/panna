import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { IDLE } from "@/lib/writing/dashboard/action-state";
import { STAND_IN_WRITER } from "@/lib/writing/stand-in-writer";

import { NOT_FOUND, redirectedTo, resetRouteState, routeState } from "./__fixtures__/route-mocks";

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("next/cache", () => cache);
vi.mock("@/config/server", async () => (await import("./__fixtures__/route-mocks")).mockServerConfig());
vi.mock("@/i18n/server", async () => (await import("./__fixtures__/route-mocks")).mockTranslator());
vi.mock("@/lib/writing", async () => ({
  getWritingServices: (await import("./__fixtures__/route-mocks")).getWritingServices,
}));

const actions = await import("./actions");

const form = (fields: Record<string, string> = {}) => {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
};

beforeEach(() => {
  resetRouteState();
  cache.revalidatePath.mockClear();
});

describe("the /write Server Actions", () => {
  it("save through the repository in the request's language and revalidate /write (AC-3)", async () => {
    routeState.locale = "hi";

    expect(await actions.createChapter(IDLE, form({ title: "दूसरा" }))).toMatchObject({ status: "ok" });

    expect(await routeState.repository.listChapters(STAND_IN_WRITER)).toMatchObject({
      ok: true,
      value: [{ title: "दूसरा", language: "hi" }],
    });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/write");
  });

  it("open the first page in the editor after starting to write (AC-1)", async () => {
    await expect(actions.startWriting(IDLE, form())).rejects.toMatchObject(redirectedTo("/write/pages/[0-9a-f-]{36}"));
  });

  it.each(["createPage", "renameChapter", "renamePage", "moveChapter", "movePage"] as const)(
    "%s answers a malformed form with a translated failure, saving nothing (AC-8)",
    async (name) => {
      expect(await actions[name](IDLE, form())).toEqual({ status: "failed", message: catalogues.en["write.error.saveFailed"] });
      expect(cache.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("send a signed-out visitor to sign in (AC-7)", async () => {
    routeState.writer = null;
    await expect(actions.createChapter(IDLE, form({ title: "One" }))).rejects.toMatchObject(
      redirectedTo("/login?next=%2Fwrite"),
    );
  });

  it("are a 404 with stand-in writing off, so production's shared store can't be written", async () => {
    routeState.serverConfig.standInWriting = false;
    await expect(actions.createChapter(IDLE, form({ title: "One" }))).rejects.toMatchObject(NOT_FOUND);
    expect(await routeState.repository.listChapters(STAND_IN_WRITER)).toEqual({ ok: true, value: [] });
  });
});
