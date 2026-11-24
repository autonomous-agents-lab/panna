import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "./proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

const getUser = vi.fn();

function request(cookie = "sb-auth=old") {
  return new NextRequest("http://localhost:3000/settings", { headers: { cookie } });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  vi.mocked(createServerClient).mockReturnValue({ auth: { getUser } } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("updateSession (AC-4)", () => {
  it("creates the client from config over the request cookies and returns the verified user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const { response, user, supabase } = await updateSession(request());

    expect(user).toEqual({ id: "u1" });
    expect(supabase).toBe(vi.mocked(createServerClient).mock.results[0]!.value);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const [url, key, options] = vi.mocked(createServerClient).mock.calls[0]!;
    expect([url, key]).toEqual(["http://127.0.0.1:54321", "anon"]);
    expect(options.cookies.getAll()).toEqual([{ name: "sb-auth", value: "old" }]);
  });

  it("writes refreshed cookies onto the request and the response, with no-store headers", async () => {
    const incoming = request();
    getUser.mockImplementation(async () => {
      const { cookies } = vi.mocked(createServerClient).mock.calls[0]![2];
      cookies.setAll?.([{ name: "sb-auth", value: "new", options: { path: "/", httpOnly: true } }], {
        "Cache-Control": "private, no-store",
      });
      return { data: { user: { id: "u1" } }, error: null };
    });

    const { response } = await updateSession(incoming);

    expect(incoming.cookies.get("sb-auth")?.value).toBe("new");
    expect(response.cookies.get("sb-auth")).toMatchObject({ value: "new", path: "/", httpOnly: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("passes the request through as signed out when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);

    const { response, user, supabase } = await updateSession(request());

    expect(user).toBeNull();
    expect(supabase).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
