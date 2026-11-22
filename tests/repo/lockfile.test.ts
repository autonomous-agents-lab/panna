import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// npm/cli#4828: a lockfile written on one platform can drop every native binding of a
// package, so `npm ci` elsewhere installs none. These checks keep CI (ubuntu-latest,
// glibc) and developer Macs installable from the same lockfile.

const repoRoot = join(import.meta.dirname, "..", "..");
const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

type LockPackage = {
  version?: string;
  optional?: boolean;
  os?: string[];
  cpu?: string[];
  libc?: string[];
  optionalDependencies?: Record<string, string>;
};
type Lockfile = { packages: Record<string, LockPackage> };
type PackageJson = { optionalDependencies?: Record<string, string> };

const lockfile = JSON.parse(read("package-lock.json")) as Lockfile;
const packageJson = JSON.parse(read("package.json")) as PackageJson;
const lockEntries = Object.entries(lockfile.packages);
const rootPins = Object.entries(packageJson.optionalDependencies ?? {});

const linuxPlatforms = ["linux-x64-gnu"];
const macPlatforms = ["darwin-arm64", "darwin-x64"];

/** Native bindings a locked package asks for on `platform` that the lockfile does not provide at that exact version. */
function missingBindings(platform: string): string[] {
  return lockEntries.flatMap(([path, entry]) =>
    Object.entries(entry.optionalDependencies ?? {})
      .filter(([binding]) => binding.endsWith(`-${platform}`))
      .filter(([binding, version]) => lockfile.packages[`node_modules/${binding}`]?.version !== version)
      .map(([binding, version]) => `${path} needs ${binding}@${version}`),
  );
}

/** The locked package a root binding pin belongs to: `@rolldown/binding-x` → `rolldown`, `lightningcss-x` → `lightningcss`. */
function parentOf(binding: string): string {
  const scoped = /^@([^/]+)\/binding-/.exec(binding);
  if (scoped) return scoped[1]!;
  return binding.split("-")[0]!;
}

describe("package-lock.json native bindings", () => {
  it.each(linuxPlatforms)("locks every %s binding so npm ci works on ubuntu-latest (AC-1)", (platform) => {
    expect(missingBindings(platform)).toEqual([]);
  });

  it.each(macPlatforms)("locks every %s binding so npm ci works on macOS (AC-2)", (platform) => {
    expect(missingBindings(platform)).toEqual([]);
  });

  // npm does not always copy a binding's `libc` into the lockfile; when it is absent npm ci
  // installs on any libc, so only a recorded libc that excludes glibc would skip ubuntu-latest.
  it("locks each pinned Linux binding as optional linux/x64 that installs on glibc", () => {
    const linuxPins = rootPins.filter(([binding]) => binding.includes("-linux-"));
    expect(linuxPins.length).toBeGreaterThan(0);
    for (const [binding] of linuxPins) {
      const entry = lockfile.packages[`node_modules/${binding}`];
      expect(entry, binding).toMatchObject({ optional: true, os: ["linux"], cpu: ["x64"] });
      expect(entry?.libc ?? ["glibc"], binding).toContain("glibc");
    }
  });

  it("pins each root binding to the exact version of its locked parent package", () => {
    expect(rootPins.length).toBeGreaterThan(0);
    for (const [binding, pin] of rootPins) {
      const parent = lockfile.packages[`node_modules/${parentOf(binding)}`];
      expect(parent, `${binding} has no locked parent`).toBeDefined();
      expect(pin, binding).toBe(parent?.version);
      expect(parent?.optionalDependencies?.[binding], binding).toBe(pin);
    }
  });
});
