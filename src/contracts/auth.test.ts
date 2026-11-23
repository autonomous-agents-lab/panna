import { describe, expect, it } from "vitest";

import { loginErrorCodeSchema, magicLinkRequestSchema } from "./auth";

describe("magicLinkRequestSchema (AC-1)", () => {
  it("accepts a valid email and trims it", () => {
    expect(magicLinkRequestSchema.parse({ email: "  writer@example.org " })).toEqual({ email: "writer@example.org" });
  });

  it.each(["", "   ", "writer", "writer@", "@example.org", "writer@example", `${"a".repeat(250)}@example.org`])(
    "rejects %j",
    (email) => {
      expect(magicLinkRequestSchema.safeParse({ email }).success).toBe(false);
    },
  );

  it("rejects a missing or non-text email", () => {
    expect(magicLinkRequestSchema.safeParse({}).success).toBe(false);
    expect(magicLinkRequestSchema.safeParse({ email: 42 }).success).toBe(false);
  });
});

describe("loginErrorCodeSchema", () => {
  it("knows only the login error codes", () => {
    expect(loginErrorCodeSchema.options).toEqual(["link_invalid", "send_failed", "oauth_failed"]);
    expect(loginErrorCodeSchema.safeParse("<script>").success).toBe(false);
  });
});
