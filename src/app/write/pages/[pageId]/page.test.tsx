import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { STAND_IN_WRITER } from "@/lib/writing/stand-in-writer";

import { NOT_FOUND, redirectedTo, resetRouteState, routeState } from "../../__fixtures__/route-mocks";

vi.mock("@/config/server", async () => (await import("../../__fixtures__/route-mocks")).mockServerConfig());
vi.mock("@/i18n/server", async () => (await import("../../__fixtures__/route-mocks")).mockTranslator());
vi.mock("@/lib/writing", async () => ({
  getWritingServices: (await import("../../__fixtures__/route-mocks")).getWritingServices,
}));

const { default: EditorPage, generateMetadata } = await import("./page");

const open = (pageId: string) => EditorPage({ params: Promise.resolve({ pageId }) });

async function newPage(title: string | null) {
  const page = await routeState.repository.createPage(STAND_IN_WRITER, {
    firstChapterTitle: "One",
    language: "hi",
    ...(title === null ? {} : { title }),
  });
  if (!page.ok) throw new Error("seeding failed");
  return page.value.id;
}

beforeEach(resetRouteState);

describe("the editor placeholder (AC-1)", () => {
  it.each(["en", "hi"] as const)("in %s, shows the page's title, language and status, with a link back", async (locale) => {
    routeState.locale = locale;
    const t = catalogues[locale];
    const html = renderToStaticMarkup(await open(await newPage("पहला पन्ना")));

    expect(html).toContain(`<h1>${t["write.editor.title"]}</h1>`);
    expect(html).toContain('lang="hi">पहला पन्ना</span>');
    expect(html).toContain(`<dd>${t["write.language.hi"]}</dd>`);
    expect(html).toContain(`>${t["write.status.draft"]}</span>`);
    expect(html).toMatch(new RegExp(`<a [^>]*href="/write"[^>]*>${t["write.editor.back"]}</a>`));
  });

  it("calls an untitled page by its placeholder", async () => {
    const html = renderToStaticMarkup(await open(await newPage(null)));
    expect(html).toContain(`${catalogues.en["write.untitledPage"]}</span>`);
  });

  it.each([
    ["an unknown page", "00000000-0000-4000-8000-0000000000ff"],
    ["a malformed id", "../etc"],
  ])("is a 404 for %s", async (_, pageId) => {
    await expect(open(pageId)).rejects.toMatchObject(NOT_FOUND);
  });

  it("is a 404 for another writer's page", async () => {
    const pageId = await newPage("Mine");
    routeState.writer = { userId: "00000000-0000-4000-8000-0000000000aa", bookId: "00000000-0000-4000-8000-0000000000bb" };
    await expect(open(pageId)).rejects.toMatchObject(NOT_FOUND);
  });

  it("sends a signed-out visitor to sign in, coming back to /write, not to a path from the request (AC-7)", async () => {
    routeState.writer = null;
    await expect(open("00000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject(redirectedTo("/login?next=%2Fwrite"));
  });

  it("is noindex", async () => {
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true });
  });

  it("is a 404 with stand-in writing off", async () => {
    routeState.serverConfig.standInWriting = false;
    await expect(open(await newPage("Mine"))).rejects.toMatchObject(NOT_FOUND);
    expect(() => generateMetadata()).toThrow(expect.objectContaining(NOT_FOUND));
  });
});
