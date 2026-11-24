import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingResult } from "@/contracts/onboarding";

class Redirect extends Error {
  constructor(readonly location: string) {
    super(`NEXT_REDIRECT ${location}`);
  }
}

const redirect = vi.hoisted(() => vi.fn());
const getCurrentUser = vi.hoisted(() => vi.fn());
const persistLocale = vi.hoisted(() => vi.fn());
const findProfileUsername = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const supabase = vi.hoisted(() => ({ rpc }));
const checkAvailability = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/i18n/locale-cookie", () => ({ persistLocale }));
vi.mock("@/lib/profile/lookup", () => ({ findProfileUsername }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => supabase }));
vi.mock("@/lib/onboarding/availability", () => ({
  checkAvailability,
  supabaseAvailabilityLookups: (client: unknown) => ({ client }),
}));

const { checkUsername, createProfile } = await import("./actions");

const IDLE: OnboardingResult = { status: "idle" };
const VALID = { username: "Asha", display_name: " Asha Rao ", preferred_language: "hi" };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

/** Runs the action; returns its result, or where it redirected. */
async function submit(entries: Record<string, string>): Promise<OnboardingResult | { redirectedTo: string }> {
  try {
    return await createProfile(IDLE, form(entries));
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.location };
    throw error;
  }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  redirect.mockImplementation((location: string) => {
    throw new Redirect(location);
  });
  getCurrentUser.mockResolvedValue({ id: "u1", email: "asha@example.org" });
  rpc.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("createProfile (AC-3)", () => {
  it("creates the profile and book, switches the UI language and opens /<username>", async () => {
    expect(await submit(VALID)).toEqual({ redirectedTo: "/asha" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_profile_with_book", {
      p_username: "asha",
      p_display_name: "Asha Rao",
      p_preferred_language: "hi",
    });
    expect(persistLocale).toHaveBeenCalledExactlyOnceWith("hi");
  });
});

describe("createProfile when the name was claimed meanwhile (AC-4)", () => {
  it("reports taken inline, keeps what was typed, and neither redirects nor switches language", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "profiles_username_lower_key"' },
    });
    expect(await submit(VALID)).toEqual({ status: "invalid", errors: { username: "taken" }, values: VALID });
    expect(redirect).not.toHaveBeenCalled();
    expect(persistLocale).not.toHaveBeenCalled();
  });

  it.each([
    ["username_held", "held"],
    ["username_reserved", "reserved"],
  ])("reports the database's %s inline as %s", async (message, code) => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message } });
    expect(await submit(VALID)).toEqual({ status: "invalid", errors: { username: code }, values: VALID });
  });
});

describe("createProfile other outcomes", () => {
  const duplicateProfile = { code: "23505", message: 'duplicate key value violates unique constraint "profiles_pkey"' };

  it("opens the existing book when the user already has a profile", async () => {
    rpc.mockResolvedValue({ data: null, error: duplicateProfile });
    findProfileUsername.mockResolvedValue("asha_old");
    expect(await submit(VALID)).toEqual({ redirectedTo: "/asha_old" });
    expect(findProfileUsername).toHaveBeenCalledWith(supabase, "u1");
    expect(persistLocale).not.toHaveBeenCalled();
  });

  it.each([
    ["no profile is found", async () => null],
    ["the lookup fails", async () => Promise.reject(new Error("down"))],
  ])("reports a failure when a duplicate profile is reported but %s", async (_case, lookup) => {
    rpc.mockResolvedValue({ data: null, error: duplicateProfile });
    findProfileUsername.mockImplementation(lookup);
    expect(await submit(VALID)).toEqual({ status: "failed", values: VALID });
  });

  it("reports any other database error as a failure, keeping the values", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await submit(VALID)).toEqual({ status: "failed", values: VALID });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("createProfile rejects crafted requests (AC-5)", () => {
  it("sends a signed-out request to /login and never calls the database", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await submit(VALID)).toEqual({ redirectedTo: "/login?next=%2Fonboarding" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["missing fields", {}, { username: "too_short", display_name: "required", preferred_language: "unsupported" }],
    ["a reserved name", { ...VALID, username: "settings" }, { username: "reserved" }],
    ["a 51-character display name", { ...VALID, display_name: "a".repeat(51) }, { display_name: "too_long" }],
    ["an unsupported language", { ...VALID, preferred_language: "fr" }, { preferred_language: "unsupported" }],
  ])("returns %s as invalid without writing anything", async (_case, entries, errors) => {
    expect(await submit(entries)).toMatchObject({ status: "invalid", errors });
    expect(rpc).not.toHaveBeenCalled();
    expect(persistLocale).not.toHaveBeenCalled();
  });

  it("ignores an id or user_id in the form: ownership comes from the session", async () => {
    await submit({ ...VALID, id: "00000000-0000-4000-8000-000000000000", user_id: "someone-else" });
    const [, args] = rpc.mock.calls[0]!;
    expect(Object.keys(args).sort()).toEqual(["p_display_name", "p_preferred_language", "p_username"]);
    expect(JSON.stringify(args)).not.toContain("someone-else");
  });
});

describe("checkUsername (AC-2)", () => {
  it("checks the typed name against the database through the shared rules", async () => {
    checkAvailability.mockResolvedValue({ status: "available", username: "asha" });
    await expect(checkUsername("Asha")).resolves.toEqual({ status: "available", username: "asha" });
    expect(checkAvailability).toHaveBeenCalledWith("Asha", { client: supabase });
  });

  it("answers unknown for anything but a string", async () => {
    await expect(checkUsername({ username: "asha" })).resolves.toEqual({ status: "unknown" });
    expect(checkAvailability).not.toHaveBeenCalled();
  });

  it("answers unknown when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    await expect(checkUsername("asha")).resolves.toEqual({ status: "unknown" });
    expect(checkAvailability).not.toHaveBeenCalled();
  });
});
