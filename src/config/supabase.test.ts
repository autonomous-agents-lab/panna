import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import type { RawEnv } from "./schema";
import { loadSupabaseConfig } from "./supabase";

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const valid: RawEnv = { [URL_VAR]: "http://127.0.0.1:54321", [KEY_VAR]: "local-anon-key" };

function thrownBy(run: () => unknown): ZodError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
    return error as ZodError;
  }
  throw new Error("expected a ZodError");
}

function expectEnvError(raw: RawEnv, variable: string) {
  const error = thrownBy(() => loadSupabaseConfig(raw));
  expect(error.issues.map((issue) => issue.path)).toEqual([[variable]]);
  expect(error.message).toContain(variable);
  expect(error.message).toContain("npx supabase status");
  return error;
}

describe("loadSupabaseConfig", () => {
  it("returns the URL and anon key", () => {
    expect(loadSupabaseConfig(valid)).toEqual({ url: "http://127.0.0.1:54321", anonKey: "local-anon-key" });
  });

  it("trims the anon key", () => {
    expect(loadSupabaseConfig({ ...valid, [KEY_VAR]: "  local-anon-key " }).anonKey).toBe("local-anon-key");
  });

  describe.each([URL_VAR, KEY_VAR])("%s", (variable) => {
    it.each([undefined, "", "   "])("is reported as not set when %j", (value) => {
      const error = expectEnvError({ ...valid, [variable]: value }, variable);
      expect(error.issues[0]?.message).toContain(`${variable} is not set`);
    });
  });

  it("names both variables when both are missing", () => {
    const error = thrownBy(() => loadSupabaseConfig({}));
    expect(error.issues.map((issue) => issue.path)).toEqual([[URL_VAR], [KEY_VAR]]);
  });

  it("rejects a URL that is not absolute without echoing the value", () => {
    const error = expectEnvError({ ...valid, [URL_VAR]: "not-a-url" }, URL_VAR);
    expect(error.issues[0]?.message).toContain(`${URL_VAR} must be an absolute URL`);
    expect(error.message).not.toContain("not-a-url");
  });

  it("rejects an anon key that is not text without echoing the value", () => {
    const error = expectEnvError({ ...valid, [KEY_VAR]: 12345 as unknown as string }, KEY_VAR);
    expect(error.issues[0]?.message).toContain(`${KEY_VAR} must be text`);
    expect(error.message).not.toContain("12345");
  });
});

describe("getSupabaseConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the variables from process.env when called", async () => {
    const { getSupabaseConfig } = await import("./index");
    vi.stubEnv(URL_VAR, "https://project.supabase.co");
    vi.stubEnv(KEY_VAR, "anon");

    expect(getSupabaseConfig()).toEqual({ url: "https://project.supabase.co", anonKey: "anon" });
  });

  it("throws naming the missing variable", async () => {
    const { getSupabaseConfig } = await import("./index");
    vi.stubEnv(URL_VAR, "https://project.supabase.co");
    vi.stubEnv(KEY_VAR, undefined);

    expect(() => getSupabaseConfig()).toThrow(KEY_VAR);
  });
});

describe("hasSupabaseConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true when both variables are valid", async () => {
    const { hasSupabaseConfig } = await import("./index");
    vi.stubEnv(URL_VAR, "https://project.supabase.co");
    vi.stubEnv(KEY_VAR, "anon");

    expect(hasSupabaseConfig()).toBe(true);
  });

  it.each([
    [undefined, "anon"],
    ["not-a-url", "anon"],
    ["https://project.supabase.co", " "],
  ])("is false, without throwing, for URL %j and key %j", async (url, key) => {
    const { hasSupabaseConfig } = await import("./index");
    vi.stubEnv(URL_VAR, url);
    vi.stubEnv(KEY_VAR, key);

    expect(hasSupabaseConfig()).toBe(false);
  });
});
