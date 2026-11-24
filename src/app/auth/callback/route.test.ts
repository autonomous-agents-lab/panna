import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const supabase = vi.hoisted(() => ({ auth: { exchangeCodeForSession } }));
const createSupabaseServerClient = vi.hoisted(() => vi.fn(async () => supabase));
const findProfileUsername = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/profile/lookup", () => ({ findProfileUsername }));

const { GET } = await import("./route");

const ORIGIN = "http://localhost:3100";

async function callback(query: string) {
  const response = await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`));
  expect(response.status).toBe(307);
  return response.headers.get("location");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" }, session: {} }, error: null });
  findProfileUsername.mockResolvedValue("asha");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /auth/callback (AC-2)", () => {
  it("exchanges the code for a session, then goes on to next on the request's origin", async () => {
    expect(await callback("?code=abc&next=%2Fsettings%3Ftab%3D1")).toBe(`${ORIGIN}/settings?tab=1`);
    expect(exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("abc");
  });

  it("goes home when there is no next", async () => {
    expect(await callback("?code=abc")).toBe(`${ORIGIN}/`);
  });

  it.each(["https%3A%2F%2Fevil.com", "%2F%2Fevil.com", "%2F%5Cevil.com"])(
    "goes home, never off-site, for next=%s (AC-5)",
    async (next) => {
      expect(await callback(`?code=abc&next=${next}`)).toBe(`${ORIGIN}/`);
    },
  );
});

describe("GET /auth/callback onboarding (BOOK-20 AC-1)", () => {
  it("sends a user with no profile yet to /onboarding, whatever next asked for", async () => {
    findProfileUsername.mockResolvedValue(null);
    expect(await callback("?code=abc&next=%2Fsettings")).toBe(`${ORIGIN}/onboarding`);
    expect(findProfileUsername).toHaveBeenCalledExactlyOnceWith(supabase, "u1");
  });

  it("continues to next for a user who already has a profile", async () => {
    expect(await callback("?code=abc&next=%2Fsettings")).toBe(`${ORIGIN}/settings`);
  });

  it("continues to next when the profile lookup fails, so the proxy decides there", async () => {
    findProfileUsername.mockRejectedValue(new Error("Profile lookup failed (57014)"));
    expect(await callback("?code=abc&next=%2Fsettings")).toBe(`${ORIGIN}/settings`);
  });
});

describe("GET /auth/callback failures (AC-8)", () => {
  it.each([
    ["an expired link", "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid"],
    ["only an error_code", "?code=abc&error_code=otp_expired"],
    ["a missing code", "?"],
  ])("sends %s to the localised error on /login, keeping a safe next", async (_case, query) => {
    expect(await callback(`${query}&next=%2Fsettings`)).toBe(`${ORIGIN}/login?error=link_invalid&next=%2Fsettings`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("sends a failed exchange to /login with the error", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: "invalid flow state" } });
    expect(await callback("?code=bogus")).toBe(`${ORIGIN}/login?error=link_invalid`);
  });

  it("sends an exchange that throws, e.g. opened in another browser, to /login with the error", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("PKCE code verifier not found in storage"));
    expect(await callback("?code=abc&next=%2Fonboarding")).toBe(`${ORIGIN}/login?error=link_invalid&next=%2Fonboarding`);
  });

  it("sends the user to /login with the error when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    expect(await callback("?code=abc")).toBe(`${ORIGIN}/login?error=link_invalid`);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
