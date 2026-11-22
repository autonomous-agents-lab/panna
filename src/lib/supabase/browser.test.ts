import { createBrowserClient } from "@supabase/ssr";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "./browser";

vi.mock("@supabase/ssr", () => ({ createBrowserClient: vi.fn(() => ({ kind: "browser-client" })) }));

describe("createSupabaseBrowserClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("creates the client with the public URL and anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");

    expect(createSupabaseBrowserClient()).toEqual({ kind: "browser-client" });
    expect(createBrowserClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "anon");
  });

  it("throws naming the missing variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(() => createSupabaseBrowserClient()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
