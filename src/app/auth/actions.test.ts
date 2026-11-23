import { afterEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const signOut = vi.hoisted(() => vi.fn(async (options: unknown) => void calls.push(`signOut ${JSON.stringify(options)}`)));
const createSupabaseServerClient = vi.hoisted(() => vi.fn(async () => ({ auth: { signOut } })));
const revalidatePath = vi.hoisted(() => vi.fn((path: string, type: string) => void calls.push(`revalidate ${path} ${type}`)));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    calls.push(`redirect ${url}`);
    throw new Error("NEXT_REDIRECT");
  }),
);

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

const actions = await import("./actions");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  calls.length = 0;
});

describe("signOut (AC-6)", () => {
  it("signs this browser out of Supabase, drops every cached page, then goes home", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");

    await expect(actions.signOut()).rejects.toThrow("NEXT_REDIRECT");

    // Only this session: the user's other devices stay signed in.
    expect(calls).toEqual(['signOut {"scope":"local"}', "revalidate / layout", "redirect /"]);
  });

  it("still goes home, signed out, when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);

    await expect(actions.signOut()).rejects.toThrow("NEXT_REDIRECT");

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(calls).toEqual(["revalidate / layout", "redirect /"]);
  });
});
