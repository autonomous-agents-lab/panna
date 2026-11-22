import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ cookies: new Map<string, string>(), headers: new Headers() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name) } : undefined),
  }),
  headers: async () => request.headers,
}));

const { getLocale, getMessages, getTranslator } = await import("./server");
const { catalogues } = await import("./catalogue");

beforeEach(() => {
  request.cookies.clear();
  request.headers = new Headers();
});

describe("getLocale", () => {
  it("uses the browser's preference when there is no cookie", async () => {
    request.headers.set("accept-language", "hi-IN,hi;q=0.9,en;q=0.8");
    expect(await getLocale()).toBe("hi");
    request.headers.set("accept-language", "fr-FR");
    expect(await getLocale()).toBe("en");
  });

  it("defaults to English with neither a cookie nor a header", async () => {
    expect(await getLocale()).toBe("en");
  });

  it("prefers the locale cookie", async () => {
    request.headers.set("accept-language", "en");
    request.cookies.set("locale", "hi");
    expect(await getLocale()).toBe("hi");
  });

  it("falls back to English for a tampered cookie", async () => {
    request.headers.set("accept-language", "hi");
    request.cookies.set("locale", "../..");
    expect(await getLocale()).toBe("en");
  });

  it("falls back to English for a cookie Next discarded as undecodable", async () => {
    request.headers.set("accept-language", "hi");
    request.headers.set("cookie", "locale=%E0%A4%A");
    expect(await getLocale()).toBe("en");
  });

  it("uses a cookie the locale switch just set over the one the request sent", async () => {
    request.headers.set("cookie", "locale=en");
    request.cookies.set("locale", "hi");
    expect(await getLocale()).toBe("hi");
  });
});

describe("getTranslator and getMessages", () => {
  it("bind to the request's locale", async () => {
    request.cookies.set("locale", "hi");
    const { locale, t } = await getTranslator();
    expect(locale).toBe("hi");
    expect(t("localeSwitch.label")).toBe("भाषा");
    expect(await getMessages()).toBe(catalogues.hi);
  });

  it("serve English by default", async () => {
    const { locale, t } = await getTranslator();
    expect(locale).toBe("en");
    expect(t("localeSwitch.label")).toBe("Language");
    expect(await getMessages()).toBe(catalogues.en);
  });
});
