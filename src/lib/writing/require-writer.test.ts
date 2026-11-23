import { describe, expect, it, vi } from "vitest";

import { SIGN_IN_PATH } from "@/config/auth";

import { requireWriter, signInPath } from "./require-writer";
import { WRITE_PATH, editorPath } from "./routes";
import { STAND_IN_WRITER } from "./stand-in-writer";

class Redirected extends Error {}

const redirect = vi.fn((url: string): never => {
  throw new Redirected(url);
});

describe("requireWriter (AC-7)", () => {
  it("returns the signed-in writer", async () => {
    await expect(requireWriter(async () => STAND_IN_WRITER, redirect, WRITE_PATH)).resolves.toEqual(STAND_IN_WRITER);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in, coming back to the given path", async () => {
    await expect(requireWriter(async () => null, redirect, WRITE_PATH)).rejects.toThrow(new Redirected("/login?next=%2Fwrite"));
  });
});

describe("signInPath", () => {
  it("uses the configured sign-in path and encodes where to come back to", () => {
    expect(signInPath("/write?a=b&c")).toBe(`${SIGN_IN_PATH}?next=%2Fwrite%3Fa%3Db%26c`);
  });
});

describe("editorPath", () => {
  it("opens a page under /write/pages, with the id encoded", () => {
    expect(editorPath("00000000-0000-4000-8000-000000000003")).toBe("/write/pages/00000000-0000-4000-8000-000000000003");
    expect(editorPath("../x?y")).toBe("/write/pages/..%2Fx%3Fy");
  });
});
