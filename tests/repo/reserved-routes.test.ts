import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RESERVED_USERNAMES } from "@/config/usernames";
import { validateUsername } from "@/lib/username";

const APP_DIR = join(import.meta.dirname, "..", "..", "src", "app");

/**
 * Top-level route segments: folders under src/app, except dynamic ([x]), group ((x)), private
 * (_x) and parallel (@x) folders, which never appear as a literal first path segment.
 */
function topLevelRouteSegments(dir: string = APP_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !/^[[(_@]/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

// A book lives at /<username>, so a username equal to a route could never be reached.
describe("top-level routes", () => {
  const segments = topLevelRouteSegments();

  it("are found, and the /<username> route is not among them", () => {
    expect(segments).toEqual(expect.arrayContaining(["auth", "login", "onboarding", "settings"]));
    expect(segments).not.toContain("[username]");
  });

  it.each(segments)("/%s can't be claimed as a username, in any case", (segment) => {
    expect(RESERVED_USERNAMES).toContain(segment);
    expect(validateUsername(segment).ok).toBe(false);
    expect(validateUsername(segment.toUpperCase()).ok).toBe(false);
  });

  it("reserves the writing epic's /write route before it lands", () => {
    expect(validateUsername("Write")).toEqual({ ok: false, code: "reserved" });
  });
});
