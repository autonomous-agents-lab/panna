import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "@/config";
import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";
import { STAND_IN_WRITER } from "@/lib/writing/stand-in-writer";

import { NOT_FOUND, redirectedTo, resetRouteState, routeState } from "./__fixtures__/route-mocks";

vi.mock("@/config/server", async () => (await import("./__fixtures__/route-mocks")).mockServerConfig());
vi.mock("@/i18n/server", async () => (await import("./__fixtures__/route-mocks")).mockTranslator());
vi.mock("@/lib/writing", async () => ({
  getWritingServices: (await import("./__fixtures__/route-mocks")).getWritingServices,
}));

const { default: WritePage, generateMetadata } = await import("./page");

async function renderPage(): Promise<string> {
  const page = await WritePage();
  return renderToStaticMarkup(
    <I18nProvider locale={routeState.locale} messages={catalogues[routeState.locale]}>
      {page as ReactNode}
    </I18nProvider>,
  );
}

beforeEach(resetRouteState);

describe("/write metadata (AC-7)", () => {
  it("is noindex, with a canonical path and the translated title", async () => {
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({ canonical: "/write" });
    expect(metadata.title).toEqual({ absolute: `${catalogues.en["write.title"]} · ${config.appName}` });
  });
});

describe("the /write dashboard", () => {
  it("sends a signed-out visitor to sign in, coming back to /write (AC-7)", async () => {
    routeState.writer = null;
    await expect(WritePage()).rejects.toMatchObject(redirectedTo("/login?next=%2Fwrite"));
  });

  it.each(["en", "hi"] as const)("in %s, shows the empty state for a book with nothing in it (AC-1)", async (locale) => {
    routeState.locale = locale;
    const t = catalogues[locale];
    const html = await renderPage();
    expect(html).toContain(`<h1>${t["write.title"]}</h1>`);
    expect(html).toContain(t["write.empty.heading"]);
    expect(html).toContain(t["write.empty.start"]);
    expect(html).not.toContain("<ol");
  });

  it.each(["en", "hi"] as const)(
    "in %s, lists the chapters and pages, a new-chapter form and the archived pages apart (AC-2, AC-6)",
    async (locale) => {
      routeState.locale = locale;
      const t = catalogues[locale];
      const { repository } = routeState;
      const chapter = await repository.createChapter(STAND_IN_WRITER, { title: "पहला", language: "hi" });
      if (!chapter.ok) throw new Error("seeding failed");
      await repository.createPage(STAND_IN_WRITER, { chapterId: chapter.value.id, language: "hi", title: "Kept" });
      const archived = await repository.createPage(STAND_IN_WRITER, { chapterId: chapter.value.id, language: "hi", title: "Gone" });
      if (!archived.ok) throw new Error("seeding failed");
      await repository.archivePage(STAND_IN_WRITER, { pageId: archived.value.id });

      const html = await renderPage();

      expect(html).toContain('lang="hi">पहला</h2>');
      expect(html.indexOf("Kept")).toBeLessThan(html.indexOf("<details"));
      expect(html.indexOf("Gone")).toBeGreaterThan(html.indexOf("<details"));
      expect(html).toContain(t["write.archived.summary"].replace("{count}", "1"));
      expect(html).toContain(t["write.newChapter.submit"]);
      expect(html).not.toContain(t["write.empty.heading"]);
    },
  );

  it("throws to the error page when the writer's chapters can't be listed", async () => {
    routeState.writer = { userId: STAND_IN_WRITER.userId, bookId: "00000000-0000-4000-8000-0000000000bb" };
    await expect(WritePage()).rejects.toThrow("Listing the writer's chapters failed: not_found");
  });
});

describe("with stand-in writing off (production default)", () => {
  it("is a 404, metadata included", async () => {
    routeState.serverConfig.standInWriting = false;
    await expect(WritePage()).rejects.toMatchObject(NOT_FOUND);
    expect(() => generateMetadata()).toThrow(expect.objectContaining(NOT_FOUND));
  });
});
