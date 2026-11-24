import { describe, expect, it, vi } from "vitest";

import { findProfileUsername } from "./lookup";

function client(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { supabase: { from } as never, from, select, eq };
}

describe("findProfileUsername", () => {
  it("selects only the username of the profile with that id", async () => {
    const { supabase, from, select, eq } = client({ data: { username: "asha" }, error: null });
    await expect(findProfileUsername(supabase, "u1")).resolves.toBe("asha");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("username");
    expect(eq).toHaveBeenCalledWith("id", "u1");
  });

  it("returns null when there is no profile", async () => {
    await expect(findProfileUsername(client({ data: null, error: null }).supabase, "u1")).resolves.toBeNull();
  });

  it("throws rather than reporting no profile when the database fails", async () => {
    const { supabase } = client({ data: null, error: { code: "57014", message: "timeout" } });
    await expect(findProfileUsername(supabase, "u1")).rejects.toThrow("Profile lookup failed (57014)");
  });
});
