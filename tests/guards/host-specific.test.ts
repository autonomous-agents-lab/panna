import { describe, expect, it } from "vitest";

import { findHostSpecificCode } from "./host-specific";

const scan = (content: string) => findHostSpecificCode([{ path: "src/example.ts", content }]).map((hit) => hit.match);

describe("findHostSpecificCode", () => {
  it.each([
    'import { getStore } from "@netlify/blobs";',
    "import type { Context } from '@netlify/functions';",
    'import { waitUntil } from "@vercel/functions";',
    'import "@vercel/analytics";',
    'const sdk = await import("netlify");',
    'const api = require("netlify/api");',
    'export { handler } from "@opennextjs/aws";',
  ])("catches a host-specific import: %s", (line) => {
    expect(scan(line)).toHaveLength(1);
  });

  it.each([
    ["process.env.NETLIFY", "NETLIFY"],
    ["process.env.NETLIFY_IMAGES_CDN_DOMAIN", "NETLIFY_IMAGES_CDN_DOMAIN"],
    ["process.env.VERCEL_ENV", "VERCEL_ENV"],
    ["process.env.NEXT_PUBLIC_VERCEL_URL", "NEXT_PUBLIC_VERCEL_URL"],
    ['const names = ["COMMIT_REF"];', "COMMIT_REF"],
    ["process.env.DEPLOY_URL", "DEPLOY_URL"],
    ["process.env.DEPLOY_PRIME_URL", "DEPLOY_PRIME_URL"],
    ["process.env.DEPLOY_ID", "DEPLOY_ID"],
    ["process.env.SITE_ID", "SITE_ID"],
    ["process.env.SITE_NAME", "SITE_NAME"],
    ["raw.GITHUB_SHA", "GITHUB_SHA"],
  ])("catches the host variable in %s, wherever it appears", (line, name) => {
    expect(scan(line)).toEqual([name]);
  });

  it.each([
    ["process.env.URL", "process.env.URL"],
    ["process.env.CONTEXT", "process.env.CONTEXT"],
    ["process.env.BRANCH", "process.env.BRANCH"],
    ["process.env.HEAD", "process.env.HEAD"],
    ['process.env["REVIEW_ID"]', 'process.env["REVIEW_ID"]'],
    ["process.env[ 'URL' ]", "process.env[ 'URL' ]"],
  ])("catches reading the generic host variable %s from process.env", (line, match) => {
    expect(scan(line)).toEqual([match]);
  });

  it.each([
    'import { z } from "zod";',
    'import { config } from "@/config";',
    'import netlifyLike from "netlify-like-package";',
    "process.env.NEXT_PUBLIC_SITE_URL",
    "process.env.URLS",
    "process.env.APP_VERSION",
    "const url = new URL(path, base);",
    "// Never set in Netlify or on Vercel.",
    "const CONTEXT = createContext(null);",
  ])("leaves ordinary code alone: %s", (line) => {
    expect(scan(line)).toEqual([]);
  });

  it("reports the file and line of each hit", () => {
    const hits = findHostSpecificCode([
      { path: "a.ts", content: "ok\nprocess.env.COMMIT_REF" },
      { path: "b.ts", content: "ok" },
    ]);
    expect(hits).toEqual([{ path: "a.ts", line: 2, match: "COMMIT_REF" }]);
  });
});
