import { describe, expect, it } from "vitest";

import * as config from "./index";
import { RESERVED_USERNAMES, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "./usernames";

describe("username config", () => {
  it("has the card's length limits", () => {
    expect(USERNAME_MIN_LENGTH).toBe(3);
    expect(USERNAME_MAX_LENGTH).toBe(30);
  });

  it("reserves every name once, in lowercase", () => {
    expect(new Set(RESERVED_USERNAMES).size).toBe(RESERVED_USERNAMES.length);
    for (const name of RESERVED_USERNAMES) expect(name).toBe(name.toLowerCase());
  });

  it("reserves the app's routes and files", () => {
    expect(RESERVED_USERNAMES).toEqual(
      expect.arrayContaining([
        "api",
        "login",
        "logout",
        "auth",
        "settings",
        "onboarding",
        "feed",
        "about",
        "admin",
        "help",
        "terms",
        "privacy",
        "sitemap.xml",
        "robots.txt",
        "_next",
        "static",
        "test-only",
      ]),
    );
  });

  it("is exported from src/config", () => {
    expect(config.RESERVED_USERNAMES).toBe(RESERVED_USERNAMES);
    expect(config.USERNAME_MIN_LENGTH).toBe(USERNAME_MIN_LENGTH);
  });
});
