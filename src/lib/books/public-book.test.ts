import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.hoisted(() => vi.fn());
const eq = vi.hoisted(() => vi.fn(() => ({ maybeSingle })));
const select = vi.hoisted(() => vi.fn(() => ({ eq })));
const from = vi.hoisted(() => vi.fn(() => ({ select })));
const createSupabaseServerClient = vi.hoisted(() => vi.fn(async () => ({ from })));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

const { getPublicBook } = await import("./public-book");

const ROW = {
  username: "asha",
  display_name: "Asha Rao",
  bio: null,
  avatar_path: null,
  book: { title: "Asha Rao", subtitle: null, default_language: "hi" },
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  maybeSingle.mockResolvedValue({ data: ROW, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getPublicBook (AC-6, AC-7)", () => {
  it("reads the profile and its book in one query by the lowercase username", async () => {
    await expect(getPublicBook("Asha")).resolves.toEqual(ROW);
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith(
      "username, display_name, bio, avatar_path, book:books(title, subtitle, default_language)",
    );
    expect(eq).toHaveBeenCalledWith("username", "asha");
  });

  it("is null when no one has the username", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getPublicBook("nobody")).resolves.toBeNull();
  });

  it("is null when the row doesn't match the contract, e.g. a profile without a book", async () => {
    maybeSingle.mockResolvedValue({ data: { ...ROW, book: null }, error: null });
    await expect(getPublicBook("asha")).resolves.toBeNull();
  });

  it("is null without asking when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    await expect(getPublicBook("asha")).resolves.toBeNull();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("throws when the database fails, rather than calling it missing", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "57014", message: "timeout" } });
    await expect(getPublicBook("asha")).rejects.toThrow("Book lookup failed (57014)");
  });
});
