import { describe, expect, it } from "vitest";

import { IMAGE_SRC_MAX_LENGTH } from "@/config/content";

import { imageUrl, options } from "./__fixtures__/documents";
import { isAllowedImageSrc } from "./image-src";

const allowed = (src: string, storageUrl = options.storageUrl) => isAllowedImageSrc(src, { storageUrl });
const PREFIX = "/storage/v1/object/public/page-images/";

describe("isAllowedImageSrc", () => {
  it.each([
    ["a file in the bucket", imageUrl("photo.webp")],
    ["a nested path", imageUrl("1f0e-user/2026/a_b-c.d.JPG")],
  ])("allows %s", (_name, src) => {
    expect(allowed(src)).toBe(true);
  });

  it("allows the local stack's http URL, with its port", () => {
    expect(allowed(`http://127.0.0.1:54321${PREFIX}u/a.png`, "http://127.0.0.1:54321")).toBe(true);
  });

  it("compares origins only, so a storage URL with a trailing slash or path still works", () => {
    expect(allowed(imageUrl("a.png"), `${options.storageUrl}/`)).toBe(true);
    expect(allowed(imageUrl("a.png"), `${options.storageUrl}/rest/v1`)).toBe(true);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["javascript: dressed as the path", `javascript://abcdefghijkl.supabase.co${PREFIX}a.png%0Aalert(1)`],
    ["data:", "data:image/svg+xml,<svg onload=alert(1)>"],
    ["protocol-relative", `//abcdefghijkl.supabase.co${PREFIX}a.png`],
    ["relative", `${PREFIX}a.png`],
    ["not a URL", "not a url"],
    ["empty", ""],
    ["another host", `https://evil.example${PREFIX}a.png`],
    ["a lookalike host", `https://abcdefghijkl.supabase.co.evil.example${PREFIX}a.png`],
    ["another port", `https://abcdefghijkl.supabase.co:8443${PREFIX}a.png`],
    ["another scheme for the same host", `http://abcdefghijkl.supabase.co${PREFIX}a.png`],
    ["with credentials", `https://user:pw@abcdefghijkl.supabase.co${PREFIX}a.png`],
    ["with a query", `${imageUrl("a.png")}?x=1`],
    ["with an empty query", `${imageUrl("a.png")}?`],
    ["with a fragment", `${imageUrl("a.png")}#x`],
    ["another bucket", `${options.storageUrl}/storage/v1/object/public/avatars/a.png`],
    ["a bucket with a longer name", `${options.storageUrl}/storage/v1/object/public/page-images-old/a.png`],
    ["a signed-URL path", `${options.storageUrl}/storage/v1/object/sign/page-images/a.png`],
    ["the bucket itself", imageUrl("").slice(0, -1)],
    ["a trailing slash", imageUrl("u/")],
    ["an empty segment", imageUrl("u//a.png")],
    ["a .. segment", imageUrl("u/../a.png")],
    ["an encoded .. segment", imageUrl("u/%2e%2e/a.png")],
    ["a . segment", imageUrl("./a.png")],
    ["a hidden file", imageUrl(".env")],
    ["an encoded character", imageUrl("a%20b.png")],
    ["a non-ASCII name", imageUrl("चित्र.png")],
    ["a backslash", imageUrl("u\\a.png")],
    ["an upper-case scheme", imageUrl("a.png").replace("https", "HTTPS")],
    ["surrounding whitespace", ` ${imageUrl("a.png")}`],
  ])("rejects %s", (_name, src) => {
    expect(allowed(src)).toBe(false);
  });

  it("rejects a src over the length limit, and allows one at it", () => {
    const base = imageUrl("");
    expect(allowed(base + "a".repeat(IMAGE_SRC_MAX_LENGTH - base.length))).toBe(true);
    expect(allowed(base + "a".repeat(IMAGE_SRC_MAX_LENGTH - base.length + 1))).toBe(false);
  });

  it("allows only http and https, even when the storage URL uses another scheme", () => {
    expect(allowed(`ftp://files.example${PREFIX}a.png`, "ftp://files.example")).toBe(false);
  });
});
