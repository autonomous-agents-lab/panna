import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const repoRoot = join(import.meta.dirname, "..", "..");
const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

type Step = {
  uses?: string;
  run?: string;
  if?: string;
  id?: string;
  with?: Record<string, string | number>;
  env?: Record<string, string>;
  "continue-on-error"?: unknown;
};
type Job = {
  "runs-on": string;
  "timeout-minutes"?: number;
  permissions?: unknown;
  "continue-on-error"?: unknown;
  steps: Step[];
};
type Workflow = {
  on: Record<string, { branches?: string[]; types?: string[] }>;
  permissions: unknown;
  concurrency: { group: string; "cancel-in-progress": string };
  jobs: Record<string, Job>;
};

const workflowText = read(".github/workflows/ci.yml");
const workflow = parse(workflowText) as Workflow;
const jobs = Object.entries(workflow.jobs);
const allSteps = jobs.flatMap(([, job]) => job.steps);
const packageJson = JSON.parse(read("package.json")) as { devDependencies: Record<string, string> };

const job = (name: string) => {
  const found = workflow.jobs[name];
  if (!found) throw new Error(`ci.yml has no ${name} job`);
  return found;
};
const runs = (name: string) => job(name).steps.flatMap((step) => (step.run ? [step.run] : []));
const stepUsing = (name: string, action: string) => {
  const found = job(name).steps.find((step) => step.uses?.startsWith(`${action}@`));
  if (!found) throw new Error(`${name} job doesn't use ${action}`);
  return found;
};

const NODE_CHECKS = {
  typecheck: "npm run typecheck",
  lint: "npm run lint",
  unit: "npm run test:unit",
  build: "npm run test:build",
  e2e: "npm run test:e2e",
} as const;

describe("CI triggers and Node (AC-1, AC-7)", () => {
  it("runs on pull requests to main (default opened/synchronize/reopened) and pushes to main", () => {
    expect(Object.keys(workflow.on).sort()).toEqual(["pull_request", "push"]);
    expect(workflow.on.pull_request).toEqual({ branches: ["main"] });
    expect(workflow.on.push).toEqual({ branches: ["main"] });
  });

  it("runs every check as its own job, so each reports its own status check", () => {
    expect(Object.keys(workflow.jobs).sort()).toEqual(
      ["build", "db", "e2e", "lint", "secrets", "typecheck", "unit"].sort(),
    );
  });

  it.each(Object.entries(NODE_CHECKS))("%s installs locked deps on Node 22, then runs %s", (name, command) => {
    expect(read(".nvmrc").trim()).toBe("22");
    expect(stepUsing(name, "actions/setup-node").with).toMatchObject({ "node-version-file": ".nvmrc" });
    const commands = runs(name);
    expect(commands).toContain(command);
    expect(commands.indexOf("npm ci")).toBeGreaterThanOrEqual(0);
    expect(commands.indexOf("npm ci")).toBeLessThan(commands.indexOf(command));
  });

  it("generates Next's route types before typechecking, since they are git-ignored", () => {
    const commands = runs("typecheck");
    expect(commands.indexOf("npx next typegen")).toBeLessThan(commands.indexOf("npm run typecheck"));
    expect(commands.indexOf("npx next typegen")).toBeGreaterThanOrEqual(0);
  });
});

describe("CI fails on a failing check (AC-2)", () => {
  it("never lets a job or step continue on error", () => {
    for (const [name, entry] of jobs) {
      expect(entry["continue-on-error"], name).toBeUndefined();
      for (const step of entry.steps) expect(step["continue-on-error"], name).toBeUndefined();
    }
  });

  it("never swallows a failing command's exit code", () => {
    for (const step of allSteps) {
      expect(step.run ?? "").not.toMatch(/\|\|\s*true|set \+e/);
    }
  });
});

describe("CI database job (AC-3)", () => {
  it("uses the same Supabase CLI version as the devDependency", () => {
    expect(String(stepUsing("db", "supabase/setup-cli").with?.version)).toBe(packageJson.devDependencies.supabase);
  });

  it("starts a fresh local Supabase, applies every migration, then runs the policy tests", () => {
    const commands = runs("db");
    const start = commands.findIndex((command) => command.startsWith("supabase start"));
    const reset = commands.indexOf("supabase db reset --local");
    const tests = commands.indexOf("npm run test:db");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(reset).toBeGreaterThan(start);
    expect(tests).toBeGreaterThan(reset);
  });

  it("keeps Postgres, Auth and the API running", () => {
    const start = runs("db").find((command) => command.startsWith("supabase start")) ?? "";
    const excluded = /-x (\S+)/.exec(start)?.[1]?.split(",") ?? [];
    for (const needed of ["postgres", "gotrue", "kong", "postgrest"]) expect(excluded).not.toContain(needed);
  });
});

describe("CI secret scanning (AC-4)", () => {
  const scanStep = job("secrets").steps.find((step) => step.run?.includes("gitleaks"));

  it("checks out the full history so the PR's commits can be scanned", () => {
    expect(stepUsing("secrets", "actions/checkout").with).toMatchObject({ "fetch-depth": 0 });
  });

  it("runs a pinned gitleaks image over the PR's base..head range, failing with the value redacted", () => {
    const script = scanStep?.run ?? "";
    expect(script).toMatch(/ghcr\.io\/gitleaks\/gitleaks:v\d+\.\d+\.\d+ /);
    expect(script).toContain('range="$PR_BASE_SHA..$PR_HEAD_SHA"');
    expect(script).toContain('range="$PUSH_BEFORE_SHA..$PUSH_AFTER_SHA"');
    expect(script).toContain('--log-opts="$range"');
    expect(script).toContain("--redact");
    expect(script).toContain("--exit-code 1");
    expect(script).toContain("--config .gitleaks.toml");
  });

  it("passes event values through env, never interpolated into the script", () => {
    expect(scanStep?.env).toMatchObject({
      PR_BASE_SHA: "${{ github.event.pull_request.base.sha }}",
      PR_HEAD_SHA: "${{ github.event.pull_request.head.sha }}",
      PUSH_BEFORE_SHA: "${{ github.event.before }}",
    });
    for (const step of allSteps) expect(step.run ?? "").not.toContain("${{");
  });
});

describe(".gitleaks.toml", () => {
  const config = read(".gitleaks.toml");
  const ruleRegex = (id: string) => {
    const rule = config.split("[[rules]]").find((section) => section.includes(`id = "${id}"`));
    const source = /^regex = '''(.+)'''$/m.exec(rule ?? "")?.[1];
    if (!source) throw new Error(`.gitleaks.toml has no regex for ${id}`);
    return new RegExp(source);
  };
  // Built at runtime so no secret-shaped string is ever committed.
  const segment = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = (payload: object) =>
    `${segment({ alg: "HS256", typ: "JWT" })}.${segment(payload)}.${"s".repeat(43)}`;

  it("extends the default rules, which cover private keys and generic JWTs", () => {
    expect(config.split("[extend]")[1]).toMatch(/^useDefault = true$/m);
  });

  it.each(["a", "ab", "abc"])("flags a Supabase service-role JWT (issuer %s shifts the base64 alignment)", (iss) => {
    const serviceRole = ruleRegex("supabase-service-role-jwt");
    expect(serviceRole.test(jwt({ iss, role: "service_role", exp: 1983812996 }))).toBe(true);
    expect(serviceRole.test(jwt({ iss, role: "anon", exp: 1983812996 }))).toBe(false);
  });

  it("flags a Supabase secret API key", () => {
    const secretKey = ruleRegex("supabase-secret-key");
    expect(secretKey.test(`sb_secret_${"x".repeat(32)}`)).toBe(true);
    expect(secretKey.test(`sb_publishable_${"x".repeat(32)}`)).toBe(false);
  });
});

describe("CI speed (AC-5)", () => {
  it("caches npm in every Node job", () => {
    for (const name of Object.keys(NODE_CHECKS)) {
      expect(stepUsing(name, "actions/setup-node").with).toMatchObject({ cache: "npm" });
    }
  });

  it("caches Playwright browsers per Playwright version and installs them only on a miss", () => {
    const cache = stepUsing("e2e", "actions/cache");
    expect(cache.with?.path).toBe("~/.cache/ms-playwright");
    expect(cache.with?.key).toContain("${{ steps.playwright.outputs.version }}");
    const install = job("e2e").steps.find((step) => step.run === "npx playwright install --with-deps chromium");
    expect(install?.if).toBe(`steps.${cache.id}.outputs.cache-hit != 'true'`);
  });

  it("caches the Next build cache", () => {
    expect(stepUsing("build", "actions/cache").with?.path).toBe(".next/cache");
  });

  it("caps every job at 10 minutes", () => {
    for (const [name, entry] of jobs) {
      expect(entry["timeout-minutes"], name).toBeGreaterThan(0);
      expect(entry["timeout-minutes"], name).toBeLessThanOrEqual(10);
    }
  });

  it("cancels superseded runs of the same PR, but never cancels a push to main", () => {
    expect(workflow.concurrency.group).toContain("github.event.pull_request.number || github.ref");
    expect(workflow.concurrency["cancel-in-progress"]).toBe("${{ github.event_name == 'pull_request' }}");
  });
});

describe("CI least privilege (AC-6)", () => {
  it("grants read-only contents and no job widens it", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    for (const [name, entry] of jobs) expect(entry.permissions, name).toBeUndefined();
  });

  it("pins every action to an exact release or commit", () => {
    const uses = allSteps.flatMap((step) => (step.uses ? [step.uses] : []));
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/@(v\d+\.\d+\.\d+|[0-9a-f]{40})$/);
  });

  it("uses no repository secrets", () => {
    expect(workflowText).not.toMatch(/secrets\./);
  });
});

describe("README continuous integration", () => {
  const section = read("README.md").split("## Continuous integration")[1]?.split(/\n## /)[0] ?? "";

  it("lists every check and how to act on a secret-scanning failure", () => {
    for (const name of Object.keys(workflow.jobs)) expect(section).toContain(`\`${name}\``);
    expect(section).toMatch(/no repository secrets/i);
    expect(section).toMatch(/rotate/i);
  });
});
