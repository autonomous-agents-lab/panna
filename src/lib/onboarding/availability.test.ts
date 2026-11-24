import { describe, expect, it, vi } from "vitest";

import { checkAvailability, supabaseAvailabilityLookups, type AvailabilityLookups } from "./availability";

function lookups(overrides: Partial<AvailabilityLookups> = {}) {
  return {
    heldUntil: vi.fn(async () => null),
    isTaken: vi.fn(async () => false),
    ...overrides,
  } satisfies AvailabilityLookups;
}

describe("checkAvailability (AC-2)", () => {
  it.each([
    ["ab", "too_short"],
    ["a".repeat(31), "too_long"],
    ["asha-k", "invalid_characters"],
    ["1asha", "must_start_with_letter"],
    ["Admin", "reserved"],
    ["write", "reserved"],
  ] as const)("rejects %j as %s without asking the database", async (raw, code) => {
    const deps = lookups();
    await expect(checkAvailability(raw, deps)).resolves.toEqual({ status: "unavailable", code });
    expect(deps.heldUntil).not.toHaveBeenCalled();
    expect(deps.isTaken).not.toHaveBeenCalled();
  });

  it("reports a recently released name as held, without checking whether it is taken", async () => {
    const deps = lookups({ heldUntil: vi.fn(async () => new Date("2999-01-01T00:00:00Z")) });
    await expect(checkAvailability(" HeldName ", deps)).resolves.toEqual({ status: "unavailable", code: "held" });
    expect(deps.heldUntil).toHaveBeenCalledWith("heldname");
    expect(deps.isTaken).not.toHaveBeenCalled();
  });

  it("reports a name an active profile has as taken, in any case", async () => {
    const deps = lookups({ isTaken: vi.fn(async () => true) });
    await expect(checkAvailability("ASHA", deps)).resolves.toEqual({ status: "unavailable", code: "taken" });
    expect(deps.isTaken).toHaveBeenCalledWith("asha");
  });

  it("reports a free name as available, normalised", async () => {
    await expect(checkAvailability(" Asha_K ", lookups())).resolves.toEqual({ status: "available", username: "asha_k" });
  });

  it.each(["heldUntil", "isTaken"] as const)("says unknown, not available, when %s fails", async (failing) => {
    const deps = lookups({ [failing]: vi.fn(async () => Promise.reject(new Error("down"))) });
    await expect(checkAvailability("asha", deps)).resolves.toEqual({ status: "unknown" });
  });
});

function client({ rpc, row }: { rpc: { data: unknown; error: unknown }; row: { data: unknown; error: unknown } }) {
  const maybeSingle = vi.fn(async () => row);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { supabase: { rpc: vi.fn(async () => rpc), from } as never, from, select, eq };
}

describe("supabaseAvailabilityLookups", () => {
  const ok = { data: null, error: null };
  const failed = { data: null, error: { code: "57014", message: "timeout" } };

  it("asks username_held_until and returns the hold as a date", async () => {
    const { supabase } = client({ rpc: { data: "2999-01-01T00:00:00+00:00", error: null }, row: ok });
    await expect(supabaseAvailabilityLookups(supabase).heldUntil("asha")).resolves.toEqual(new Date("2999-01-01T00:00:00Z"));
    expect((supabase as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith("username_held_until", { p_username: "asha" });
  });

  it("returns null when the name isn't held", async () => {
    const { supabase } = client({ rpc: ok, row: ok });
    await expect(supabaseAvailabilityLookups(supabase).heldUntil("asha")).resolves.toBeNull();
  });

  it("throws when username_held_until fails", async () => {
    const { supabase } = client({ rpc: failed, row: ok });
    await expect(supabaseAvailabilityLookups(supabase).heldUntil("asha")).rejects.toThrow("username_held_until failed (57014)");
  });

  it("looks the name up in profiles", async () => {
    const taken = client({ rpc: ok, row: { data: { id: "u2" }, error: null } });
    await expect(supabaseAvailabilityLookups(taken.supabase).isTaken("asha")).resolves.toBe(true);
    expect(taken.from).toHaveBeenCalledWith("profiles");
    expect(taken.select).toHaveBeenCalledWith("id");
    expect(taken.eq).toHaveBeenCalledWith("username", "asha");

    const free = client({ rpc: ok, row: ok });
    await expect(supabaseAvailabilityLookups(free.supabase).isTaken("asha")).resolves.toBe(false);
  });

  it("throws when the profiles lookup fails", async () => {
    const { supabase } = client({ rpc: ok, row: failed });
    await expect(supabaseAvailabilityLookups(supabase).isTaken("asha")).rejects.toThrow("Username lookup failed (57014)");
  });
});
