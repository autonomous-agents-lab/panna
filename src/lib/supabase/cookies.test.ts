import { describe, expect, it, vi } from "vitest";

import { createCookieAdapter, type CookieStore } from "./cookies";

function fakeStore(overrides: Partial<CookieStore> = {}): CookieStore {
  return {
    getAll: vi.fn(() => [{ name: "sb-access", value: "a" }]),
    set: vi.fn(),
    ...overrides,
  };
}

describe("createCookieAdapter", () => {
  it("reads every cookie from the store", () => {
    const store = fakeStore();
    expect(createCookieAdapter(store).getAll()).toEqual([{ name: "sb-access", value: "a" }]);
  });

  it("writes every cookie with its options", () => {
    const store = fakeStore();
    createCookieAdapter(store).setAll(
      [
        { name: "sb-access", value: "a", options: { httpOnly: true, path: "/" } },
        { name: "sb-refresh", value: "r", options: { maxAge: 60 } },
      ],
      {},
    );

    expect(store.set).toHaveBeenNthCalledWith(1, "sb-access", "a", { httpOnly: true, path: "/" });
    expect(store.set).toHaveBeenNthCalledWith(2, "sb-refresh", "r", { maxAge: 60 });
  });

  it("skips the write when the store refuses it, as in a Server Component", () => {
    const store = fakeStore({
      set: vi.fn(() => {
        throw new Error("Cookies can only be modified in a Server Function or Route Handler.");
      }),
    });

    expect(() =>
      createCookieAdapter(store).setAll([{ name: "sb-access", value: "a", options: {} }], {}),
    ).not.toThrow();
  });
});
