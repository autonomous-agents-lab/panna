import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));

const { persistLocale } = await import("./locale-cookie");

beforeEach(() => set.mockClear());
afterEach(() => vi.unstubAllEnvs());

describe("persistLocale", () => {
  it.each(["en", "hi"] as const)("remembers %s in a year-long, httpOnly, same-site cookie", async (locale) => {
    await persistLocale(locale);
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
    await persistLocale("hi");
    expect(set.mock.calls[0]?.[2]).toMatchObject({ secure: true });
  });
});
