import { expect, it } from "vitest";

import { healthResponseSchema } from "@/contracts/health";

import { buildHealth } from "./health";

it("reports ok with the version and the time in ISO 8601 UTC, matching the contract", () => {
  const health = buildHealth({ version: "abc1234", now: new Date(Date.UTC(2026, 10, 22, 9, 30)) });
  expect(health).toEqual({ status: "ok", version: "abc1234", time: "2026-11-22T09:30:00.000Z" });
  expect(healthResponseSchema.parse(health)).toEqual(health);
});

it("the contract rejects extra keys", () => {
  expect(healthResponseSchema.safeParse({ ...buildHealth({ version: "1", now: new Date() }), env: "x" }).success).toBe(
    false,
  );
});
