import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), signInWithOAuth: vi.fn() }));
const createSupabaseServerClient = vi.hoisted(() => vi.fn(async () => ({ auth })));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("next/navigation", () => ({ redirect }));

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

async function load(siteUrl = "https://kitaab.example.org") {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  vi.resetModules();
  return import("./actions");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  auth.signInWithOAuth.mockResolvedValue({
    data: { provider: "google", url: "http://127.0.0.1:54321/auth/v1/authorize?provider=google" },
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("requestMagicLink (AC-1, AC-2)", () => {
  it("sends a link back to the configured site's callback with the safe next, and reports it sent", async () => {
    const { requestMagicLink } = await load();

    const result = await requestMagicLink({ status: "idle" }, form({ email: " writer@example.org ", next: "/settings" }));

    expect(result).toEqual({ status: "sent", email: "writer@example.org" });
    expect(auth.signInWithOtp).toHaveBeenCalledExactlyOnceWith({
      email: "writer@example.org",
      options: { emailRedirectTo: "https://kitaab.example.org/auth/callback?next=%2Fsettings" },
    });
  });

  it("drops an off-site next from the link (AC-5)", async () => {
    const { requestMagicLink } = await load();
    await requestMagicLink({ status: "idle" }, form({ email: "writer@example.org", next: "//evil.com" }));
    expect(auth.signInWithOtp.mock.calls[0]?.[0].options.emailRedirectTo).toBe(
      "https://kitaab.example.org/auth/callback",
    );
  });

  it.each<[Record<string, string>, string]>([
    [{ email: "not-an-email" }, "not-an-email"],
    [{ email: "   " }, ""],
    [{}, ""],
  ])(
    "reports %j as invalid and sends nothing",
    async (entries, email) => {
      const { requestMagicLink } = await load();
      const result = await requestMagicLink({ status: "idle" }, form(entries));
      expect(result).toEqual({ status: "invalid", email });
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
      expect(auth.signInWithOtp).not.toHaveBeenCalled();
    },
  );

  it("reports a Supabase error as failed", async () => {
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: { message: "rate limited" } });
    const { requestMagicLink } = await load();
    const result = await requestMagicLink({ status: "idle" }, form({ email: "writer@example.org" }));
    expect(result).toEqual({ status: "failed", email: "writer@example.org" });
  });

  it("reports failed, without a client, when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    const { requestMagicLink } = await load();
    const result = await requestMagicLink({ status: "idle" }, form({ email: "writer@example.org" }));
    expect(result).toEqual({ status: "failed", email: "writer@example.org" });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("signInWithGoogle (AC-3)", () => {
  it("starts Google OAuth with the callback built from the configured site URL, then follows it", async () => {
    const { signInWithGoogle } = await load("https://books.example.net");

    await expect(signInWithGoogle(form({ next: "/onboarding" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(auth.signInWithOAuth).toHaveBeenCalledExactlyOnceWith({
      provider: "google",
      options: { redirectTo: "https://books.example.net/auth/callback?next=%2Fonboarding" },
    });
    expect(redirect).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:54321/auth/v1/authorize?provider=google");
  });

  it.each([
    ["an error", { data: { provider: "google", url: null }, error: { message: "provider disabled" } }],
    ["no URL", { data: { provider: "google", url: null }, error: null }],
  ])("returns to /login with oauth_failed on %s", async (_case, response) => {
    auth.signInWithOAuth.mockResolvedValue(response);
    const { signInWithGoogle } = await load();

    await expect(signInWithGoogle(form({ next: "/settings" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login?error=oauth_failed&next=%2Fsettings");
  });

  it("returns to /login with oauth_failed when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const { signInWithGoogle } = await load();

    await expect(signInWithGoogle(form({}))).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login?error=oauth_failed");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
