import { afterEach, expect, it, vi } from "vitest";

import { healthResponseSchema } from "@/contracts/health";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("answers 200 with only status, version and time, uncached, and leaks no env values", async () => {
  vi.stubEnv("APP_VERSION", "abc1234");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "super-secret-service-role");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Kitaab");
  vi.resetModules();
  const { GET } = await import("./route");

  const before = Date.now();
  const response = GET();
  const text = await response.clone().text();
  const body = healthResponseSchema.parse(await response.json());

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(Object.keys(body).sort()).toEqual(["status", "time", "version"]);
  expect(body).toMatchObject({ status: "ok", version: "abc1234" });
  expect(Date.parse(body.time)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(body.time)).toBeLessThanOrEqual(Date.now());

  const leaked = Object.entries(process.env).filter(
    ([name, value]) => name !== "APP_VERSION" && value && value.length >= 4 && text.includes(value),
  );
  expect(leaked.map(([name]) => name)).toEqual([]);
});
