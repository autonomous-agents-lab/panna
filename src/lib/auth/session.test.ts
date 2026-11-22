import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn(async () => ({ auth: { getUser } })));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const { getCurrentUser, requireUser } = await import("./session");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getCurrentUser", () => {
  it("returns the user Supabase Auth verifies", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "writer@example.org" } }, error: null });

    await expect(getCurrentUser()).resolves.toEqual({ id: "u1", email: "writer@example.org" });
  });

  it("is null when signed out", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("is null, without creating a client, when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("requireUser (AC-4)", () => {
  it("returns the signed-in user", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    await expect(requireUser("/settings")).resolves.toEqual({ id: "u1" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to /login, returning to the page after", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);

    await expect(requireUser("/onboarding")).rejects.toThrow("NEXT_REDIRECT /login?next=%2Fonboarding");
  });
});
