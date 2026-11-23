import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..");
const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

type NetlifyToml = {
  build: { command: string; publish: string; environment: Record<string, string> };
  plugins: { package: string }[];
};

const netlifyText = read("netlify.toml");
const netlify = parse(netlifyText) as unknown as NetlifyToml;
const packageJson = JSON.parse(read("package.json")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("netlify.toml (AC-1)", () => {
  it("builds on Node 22, the version .nvmrc pins", () => {
    expect(read(".nvmrc").trim()).toBe("22");
    expect(netlify.build.environment).toEqual({ NODE_VERSION: "22" });
  });

  it("uses the Next.js runtime, pinned to an exact devDependency", () => {
    expect(netlify.plugins).toEqual([{ package: "@netlify/plugin-nextjs" }]);
    expect(packageJson.devDependencies["@netlify/plugin-nextjs"]).toMatch(/^5\.\d+\.\d+$/);
    expect(packageJson.dependencies).not.toHaveProperty("@netlify/plugin-nextjs");
  });

  it("runs our build, publishing Next's output", () => {
    expect(netlify.build.publish).toBe(".next");
    expect(netlify.build.command).toMatch(/ npm run build$/);
  });

  it("maps Netlify's commit onto APP_VERSION, so /api/health reports the deployed commit", () => {
    expect(netlify.build.command).toMatch(/(^| )APP_VERSION=\$COMMIT_REF /);
  });

  it("defaults the site URL to Netlify's production URL, letting a value set in the UI win", () => {
    expect(netlify.build.command).toContain("NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-$URL} ");
  });

  it("holds no secrets or stored env values", () => {
    expect(netlifyText).not.toMatch(/SERVICE_ROLE|ANON_KEY|SECRET|TOKEN|PASSWORD|eyJ|sb_secret_/);
    expect(netlifyText).not.toMatch(/\[context\./);
  });
});

describe("hosting docs and ignores (AC-7)", () => {
  const readme = read("README.md");
  const claude = read("CLAUDE.md");
  const envExample = read(".env.example");

  it("git-ignores Netlify's local state", () => {
    const patterns = read(".gitignore").split(/\r?\n/);
    expect(patterns).toContain(".netlify");
    expect(patterns).not.toContain(".vercel");
  });

  it.each([
    ["README.md", readme],
    ["CLAUDE.md", claude],
  ])("%s names Netlify as the host and describes the PR → preview → main → production flow", (_file, text) => {
    expect(text).not.toMatch(/vercel/i);
    expect(text).toMatch(/Netlify/);
    expect(text).toMatch(/Deploy Preview/);
    expect(text).toMatch(/production/);
    expect(text).toContain("netlify.toml");
  });

  it("README walks through the deploy flow and how to read a preview timeout", () => {
    const section = readme.split("## Deployment")[1]?.split(/\n## /)[0] ?? "";
    expect(section).toContain("https://panna-book.netlify.app");
    expect(section).toContain("PLAYWRIGHT_BASE_URL");
    expect(section).toMatch(/axe/);
    expect(section).toMatch(/merge.*`main`/i);
    expect(section).toMatch(/timed? ?out/i);
  });

  it("CLAUDE.md says host variables are mapped in netlify.toml and never read in src/", () => {
    expect(claude).toMatch(/netlify\.toml.*never.*src\//i);
  });

  it(".env.example notes which variables are set in Netlify and that the service-role key is server-only", () => {
    const block = (name: string) => envExample.split(`\n${name}=`)[0]?.split(/\n\n/).at(-1) ?? "";
    expect(block("NEXT_PUBLIC_APP_NAME")).toMatch(/^# Set in Netlify/m);
    // For now the database is local only, by the owner's decision on BOOK-17, so deploys get no
    // Supabase values. This assertion follows that decision and flips when a hosted project is wired up.
    for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
      expect(block(name), name).toMatch(/Not set in Netlify[^.]*local only/);
    }
    expect(envExample).toMatch(/service-role key[^.]*only[^.]*Netlify's server-side/i);
    expect(envExample).toMatch(/never[^.]*NEXT_PUBLIC_/i);
  });
});
