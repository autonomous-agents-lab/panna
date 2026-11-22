import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));

const { setLocale } = await import("./set-locale");

function form(entries: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

beforeEach(() => set.mockClear());
afterEach(() => vi.unstubAllEnvs());

describe("setLocale", () => {
  it.each(["en", "hi"])("remembers %s in a year-long, httpOnly, same-site cookie", async (locale) => {
    await setLocale(form({ locale }));
    expect(set).toHaveBeenCalledExactlyOnceWith("locale", locale, {
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
      httpOnly: true,
      secure: false,
    });
  });

  it("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await setLocale(form({ locale: "hi" }));
    expect(set.mock.calls[0]?.[2]).toMatchObject({ secure: true });
  });

  it.each<Record<string, string>>([
    {},
    { locale: "fr" },
    { locale: "HI" },
    { locale: "" },
    { locale: "hi; Path=/admin" },
    { lang: "hi" },
  ])(
    "ignores %j",
    async (entries) => {
      await expect(setLocale(form(entries))).resolves.toBeUndefined();
      expect(set).not.toHaveBeenCalled();
    },
  );

  it("ignores a file posted as the locale", async () => {
    const data = new FormData();
    data.append("locale", new Blob(["hi"]), "hi");
    await setLocale(data);
    expect(set).not.toHaveBeenCalled();
  });
});
