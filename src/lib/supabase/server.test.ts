import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseServerClient } from "./server";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ kind: "server-client" })) }));

const store = { getAll: vi.fn(() => [{ name: "sb-access", value: "a" }]), set: vi.fn() };

describe("createSupabaseServerClient", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue(store as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("creates the client from config with an adapter over the request cookies", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");

    await expect(createSupabaseServerClient()).resolves.toEqual({ kind: "server-client" });

    expect(createServerClient).toHaveBeenCalledOnce();
    const [url, key, options] = vi.mocked(createServerClient).mock.calls[0]!;
    expect([url, key]).toEqual(["http://127.0.0.1:54321", "anon"]);

    expect(options.cookies.getAll()).toEqual([{ name: "sb-access", value: "a" }]);
    options.cookies.setAll?.([{ name: "sb-access", value: "b", options: { path: "/" } }], {});
    expect(store.set).toHaveBeenCalledWith("sb-access", "b", { path: "/" });
  });

  it("throws naming the missing variable before touching cookies", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");

    await expect(createSupabaseServerClient()).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(cookies).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
