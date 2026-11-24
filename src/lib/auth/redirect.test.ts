import { describe, expect, it } from "vitest";

import { safeNextPath } from "./redirect";

describe("safeNextPath (AC-5)", () => {
  it.each([
    ["/settings", "/settings"],
    ["/settings/profile?tab=name#top", "/settings/profile?tab=name#top"],
    ["/onboarding?step=2", "/onboarding?step=2"],
    ["/a/../settings", "/settings"],
    ["/books/%E0%A4%AA", "/books/%E0%A4%AA"],
    ["/loginx", "/loginx"],
    ["/authors", "/authors"],
  ])("keeps the same-site path %j as %j", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it.each([
    ["an absolute URL", "https://evil.com"],
    ["an absolute URL on the site's own host", "http://localhost:3000/settings"],
    ["a protocol-relative URL", "//evil.com"],
    ["a slash-backslash URL", "/\\evil.com"],
    ["a backslash-backslash URL", "\\\\evil.com"],
    ["a backslash later in the path", "/settings\\..\\..\\evil.com"],
    ["an encoded backslash", "/%5Cevil.com"],
    ["encoded slashes", "/%2F%2Fevil.com"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a mailto: URL", "mailto:someone@example.org"],
    ["a relative path", "settings"],
    ["a tab that a URL parser would strip", "/\t/evil.com"],
    ["a newline", "/settings\nSet-Cookie: x=1"],
    ["an encoded control character", "/%0A/evil.com"],
    ["a malformed escape", "/settings%E0%A4"],
    ["an empty value", ""],
    ["the login page", "/login"],
    ["the login page with a query", "/login?next=/settings"],
    ["a page under login", "/login/again"],
    ["the auth callback", "/auth/callback?code=abc"],
    ["the auth prefix", "/auth"],
    ["a path that normalises into the login page", "/settings/../login"],
  ])("sends %s to / (%j)", (_case, value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it.each([undefined, null, 42, ["/settings"], { path: "/settings" }])("sends the non-string %j to /", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("resolves against the given base without taking its path", () => {
    expect(safeNextPath("/settings?x=1", "https://example.org/app/")).toBe("/settings?x=1");
  });
});
