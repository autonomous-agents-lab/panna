import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const findProfileUsername = vi.hoisted(() => vi.fn());
const supabase = vi.hoisted(() => ({ client: true }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => supabase }));
vi.mock("./lookup", () => ({ findProfileUsername }));

const { getCurrentProfile } = await import("./current-profile");

beforeEach(() => vi.clearAllMocks());

describe("getCurrentProfile", () => {
  it("is null when signed out, without querying profiles", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(getCurrentProfile()).resolves.toBeNull();
    expect(findProfileUsername).not.toHaveBeenCalled();
  });

  it("is null for a signed-in user who has not onboarded", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1" });
    findProfileUsername.mockResolvedValue(null);
    await expect(getCurrentProfile()).resolves.toBeNull();
    expect(findProfileUsername).toHaveBeenCalledWith(supabase, "u1");
  });

  it("is the session user's id and username once they have a profile", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: "a@example.org" });
    findProfileUsername.mockResolvedValue("asha");
    await expect(getCurrentProfile()).resolves.toEqual({ id: "u1", username: "asha" });
  });
});
