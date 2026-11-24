import { describe, expect, it } from "vitest";

import { RESERVED_USERNAMES } from "@/config/usernames";
import { validateUsername } from "@/lib/username";

import { SAMPLE_USERNAMES, sampleBookStore } from "./fixtures";

describe("sample fixtures", () => {
  it.each(Object.values(SAMPLE_USERNAMES))("%s is clearly a sample name and reserved, so no real writer can claim it", (username) => {
    expect(username).toMatch(/^sample_writer_/);
    expect(RESERVED_USERNAMES).toContain(username);
    expect(validateUsername(username)).toEqual({ ok: false, code: "reserved" });
  });

  it("are the only writers in the store", () => {
    expect(sampleBookStore.profiles.map((profile) => profile.username).sort()).toEqual(
      Object.values(SAMPLE_USERNAMES).sort(),
    );
  });

  it("hold a Hindi and an English published page, and drafts", () => {
    const published = sampleBookStore.pages.filter((page) => page.status === "published");
    expect(new Set(published.map((page) => page.language))).toEqual(new Set(["hi", "en"]));
    expect(sampleBookStore.pages.some((page) => page.status === "draft")).toBe(true);
  });
});
