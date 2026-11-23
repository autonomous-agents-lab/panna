import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

const { config, proxy } = await import("./proxy");

function passThrough(user: object | null, refreshed = false) {
  const response = NextResponse.next();
  if (refreshed) {
    response.cookies.set("sb-auth", "fresh", { path: "/", httpOnly: true });
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("expires", "0");
  }
  updateSession.mockResolvedValue({ response, user });
  return response;
}

const get = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

beforeEach(() => updateSession.mockReset());

describe("proxy (AC-4)", () => {
  it("sends a signed-out request for a protected page to /login with the path as next", async () => {
    passThrough(null);

    const response = await proxy(get("/settings/x?y=1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fsettings%2Fx%3Fy%3D1");
  });

  it.each(["/onboarding", "/settings"])("protects %s", async (path) => {
    passThrough(null);
    const response = await proxy(get(path));
    expect(response.headers.get("location")).toBe(`http://localhost:3000/login?next=${encodeURIComponent(path)}`);
  });

  it("lets a signed-in user through to a protected page", async () => {
    const refreshed = passThrough({ id: "u1" });
    expect(await proxy(get("/settings"))).toBe(refreshed);
  });

  it.each(["/", "/login", "/settingsx"])("lets anyone through to the public page %s", async (path) => {
    const refreshed = passThrough(null);
    expect(await proxy(get(path))).toBe(refreshed);
  });

  it("keeps refreshed cookies and no-store headers on the redirect", async () => {
    passThrough(null, true);

    const response = await proxy(get("/onboarding"));

    expect(response.cookies.get("sb-auth")).toMatchObject({ value: "fresh", path: "/", httpOnly: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBeNull();
  });
});

describe("proxy matcher", () => {
  const [source] = config.matcher;
  // Next anchors the matcher to the whole path.
  const matches = (path: string) => new RegExp(`^${source}$`).test(path);

  it.each(["/", "/login", "/settings", "/settings/profile", "/onboarding", "/auth/callback", "/api/other"])(
    "runs on %s",
    (path) => {
      expect(matches(path)).toBe(true);
    },
  );

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/api/health",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/icon.png",
    "/fonts/devanagari.woff2",
  ])("skips %s", (path) => {
    expect(matches(path)).toBe(false);
  });
});
