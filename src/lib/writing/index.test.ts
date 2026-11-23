import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { imageUrl, options } from "@/contracts/page-body/__fixtures__/documents";

const supabase = vi.hoisted(() => {
  const refuse = (name: string) =>
    vi.fn(() => {
      throw new Error(`${name} must not be called by the stand-in`);
    });
  return {
    createServerClient: refuse("createServerClient"),
    createBrowserClient: refuse("createBrowserClient"),
    createClient: refuse("createClient"),
    createSupabaseServerClient: refuse("createSupabaseServerClient"),
    createSupabaseBrowserClient: refuse("createSupabaseBrowserClient"),
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: supabase.createServerClient,
  createBrowserClient: supabase.createBrowserClient,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: supabase.createClient }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: supabase.createSupabaseServerClient }));
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: supabase.createSupabaseBrowserClient }));

async function load(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return import("./index");
}

const localSupabase = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };

describe("getWritingServices (AC-7)", () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, "standInWritingRepository");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    for (const spy of Object.values(supabase)) expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ["by default", undefined],
    ["when WRITING_DATA_SOURCE=stand-in", "stand-in"],
  ])("uses the in-memory repository and stand-in writer %s, without calling Supabase", async (_, source) => {
    const writing = await load({ ...localSupabase, WRITING_DATA_SOURCE: source });
    const { repository, getCurrentWriter } = writing.getWritingServices();

    expect(getCurrentWriter).toBe(writing.getStandInWriter);
    const writer = await getCurrentWriter();
    expect(writer).toEqual(writing.STAND_IN_WRITER);

    const page = await repository.createPage(writer!, { firstChapterTitle: "पहला अध्याय", language: "hi" });
    expect(page).toMatchObject({ ok: true, value: { book_id: writing.STAND_IN_WRITER.bookId } });
    const body = {
      type: "doc" as const,
      content: [{ type: "image" as const, attrs: { src: `${localSupabase.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/page-images/a.webp`, alt: "a" } }],
    };
    const pageId = page.ok ? page.value.id : "";
    expect(await repository.savePageContent(writer!, { pageId, body })).toMatchObject({ ok: true, value: { body } });
    expect(await repository.listChapters(writer!)).toMatchObject({ ok: true, value: [{ title: "पहला अध्याय" }] });
  });

  it("validates input before it reaches the store", async () => {
    const { getWritingServices, STAND_IN_WRITER } = await load(localSupabase);
    const { repository } = getWritingServices();

    expect(await repository.createChapter(STAND_IN_WRITER, { title: " ", language: "en" })).toMatchObject({
      ok: false,
      error: "invalid_input",
    });
    expect(await repository.listChapters(STAND_IN_WRITER)).toEqual({ ok: true, value: [] });
  });

  it("checks image srcs against the given storage URL", async () => {
    const { getWritingServices, STAND_IN_WRITER } = await load({});
    const { repository } = getWritingServices({ dataSource: "stand-in", pageBody: options });
    const page = await repository.createPage(STAND_IN_WRITER, { firstChapterTitle: "One", language: "en" });
    const pageId = page.ok ? page.value.id : "";
    const image = (src: string) => ({ type: "doc" as const, content: [{ type: "image" as const, attrs: { src, alt: "a" } }] });

    expect(await repository.savePageContent(STAND_IN_WRITER, { pageId, body: image(imageUrl("a.webp")) })).toMatchObject({ ok: true });
    expect(
      await repository.savePageContent(STAND_IN_WRITER, {
        pageId,
        body: image(`${localSupabase.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/page-images/a.webp`),
      }),
    ).toMatchObject({ ok: false, error: "invalid_input" });
  });

  it("keeps one store per server process, across module reloads", async () => {
    const first = await load(localSupabase);
    const writer = first.STAND_IN_WRITER;
    await first.getWritingServices().repository.createChapter(writer, { title: "Kept", language: "en" });

    const second = await load(localSupabase);
    expect(await second.getWritingServices().repository.listChapters(writer)).toMatchObject({
      ok: true,
      value: [{ title: "Kept" }],
    });
  });

  it("refuses to start with an unknown WRITING_DATA_SOURCE, naming the variable", async () => {
    await expect(load({ ...localSupabase, WRITING_DATA_SOURCE: "supabase" })).rejects.toThrow(/WRITING_DATA_SOURCE/);
  });

  it("is marked server-only and never imports the Supabase clients", () => {
    const source = readFileSync(join(import.meta.dirname, "index.ts"), "utf8");
    expect(source.startsWith('import "server-only";')).toBe(true);
    for (const file of ["index.ts", "in-memory-repository.ts", "validating-repository.ts", "stand-in-writer.ts"]) {
      expect(readFileSync(join(import.meta.dirname, file), "utf8")).not.toMatch(/@supabase\/|lib\/supabase/);
    }
  });
});

describe("getStandInWriter", () => {
  it("returns a fresh copy of the fixed writer, valid under the contract", async () => {
    const { getStandInWriter, STAND_IN_WRITER } = await import("./stand-in-writer");
    const { currentWriterSchema } = await import("@/contracts");
    const writer = await getStandInWriter();
    expect(currentWriterSchema.parse(writer)).toEqual(STAND_IN_WRITER);
    expect(writer).not.toBe(STAND_IN_WRITER);
  });
});
