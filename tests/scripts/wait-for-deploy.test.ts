import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { main, readCliEnv, waitForDeploy } from "../../scripts/wait-for-deploy.mjs";

const repoRoot = join(import.meta.dirname, "..", "..");
const BASE = "https://deploy-preview-7--site.netlify.app";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const OLD_SHA = "fedcba9876543210fedcba9876543210fedcba98";
const MINUTE = 60_000;

/** A health reply: a response, or something fetch throws. */
type Reply = Response | { throws: unknown };

const health = (version: string) => Response.json({ status: "ok", version, time: new Date(0).toISOString() });
const status = (code: number) => new Response("", { status: code });

/**
 * A fake clock and deploy. /api/health answers with `replies` in order, the last one repeating;
 * other paths answer with the status in `pages`, 200 by default.
 */
function fakeDeploy(replies: Reply[], pages: Record<string, number> = {}) {
  let time = 0;
  const queue = [...replies];
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    const path = new URL(url).pathname;
    if (path !== "/api/health") return status(pages[path] ?? 200);
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (!(reply instanceof Response)) throw reply?.throws;
    return reply.clone();
  });
  const now = () => time;
  const sleep = vi.fn(async (ms: number) => {
    time += ms;
  });
  return { fetch, now, sleep, options: { fetch, now, sleep } };
}

describe("waitForDeploy", () => {
  it("returns once /api/health reports the expected version and the key pages answer 200", async () => {
    const deploy = fakeDeploy([health(SHA)]);

    await waitForDeploy({ baseUrl: BASE, expectedVersion: SHA, timeoutMs: MINUTE, ...deploy.options });

    expect(deploy.sleep).not.toHaveBeenCalled();
    expect(deploy.fetch.mock.calls.map(([url]) => url)).toEqual([
      `${BASE}/api/health`,
      `${BASE}/`,
      `${BASE}/api/health`,
    ]);
    expect(deploy.fetch.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
  });

  it("keeps polling through a 404, an older version, a network error and a body without a version", async () => {
    const deploy = fakeDeploy([
      status(404),
      health(OLD_SHA),
      { throws: new Error("getaddrinfo ENOTFOUND") },
      new Response("not json", { status: 200 }),
      Response.json({ status: "ok" }),
      health(SHA),
    ]);

    await waitForDeploy({ baseUrl: BASE, expectedVersion: SHA, timeoutMs: MINUTE, intervalMs: 5_000, ...deploy.options });

    expect(deploy.sleep.mock.calls.map(([ms]) => ms)).toEqual([5_000, 5_000, 5_000, 5_000, 5_000]);
  });

  it.each([
    ["an HTTP status", status(503), "last seen: HTTP 503"],
    ["an older version", health(OLD_SHA), `last seen: version ${OLD_SHA}`],
    ["a network error", { throws: new Error("connect ECONNREFUSED") }, "last seen: network error (connect ECONNREFUSED)"],
    ["a non-Error rejection", { throws: "boom" }, "last seen: network error (boom)"],
    ["a 200 without a version", Response.json({}), "last seen: HTTP 200 without a version"],
  ])("times out with a message naming the URL, the SHA, the minutes and %s", async (_case, reply: Reply, lastSeen) => {
    const deploy = fakeDeploy([reply]);

    const waiting = waitForDeploy({
      baseUrl: BASE,
      expectedVersion: SHA,
      timeoutMs: 8 * MINUTE,
      intervalMs: 3 * MINUTE,
      ...deploy.options,
    });

    await expect(waiting).rejects.toThrow(`${BASE}/api/health did not report version ${SHA} within 8 minutes`);
    await expect(waiting).rejects.toThrow(lastSeen);
    await expect(waiting).rejects.toThrow(/check it in Netlify/);
    // Never sleeps past the deadline: 3 + 3 + 2 minutes.
    expect(deploy.sleep.mock.calls.map(([ms]) => ms)).toEqual([3 * MINUTE, 3 * MINUTE, 2 * MINUTE]);
  });

  it("fails when a key page doesn't answer 200 on the expected version", async () => {
    const deploy = fakeDeploy([health(SHA)], { "/": 500 });

    await expect(
      waitForDeploy({ baseUrl: BASE, expectedVersion: SHA, timeoutMs: MINUTE, ...deploy.options }),
    ).rejects.toThrow(`${BASE}/ answered HTTP 500 on version ${SHA}; expected 200.`);
  });

  it("checks only the paths it is given", async () => {
    const deploy = fakeDeploy([health(SHA)]);

    await waitForDeploy({ baseUrl: BASE, expectedVersion: SHA, timeoutMs: MINUTE, checkPaths: [], ...deploy.options });

    expect(deploy.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the real clock and sleep by default", async () => {
    const replies = [status(404), health(SHA)];
    const fetch = vi.fn(async () => replies.shift() ?? status(200));

    await waitForDeploy({ baseUrl: BASE, expectedVersion: SHA, timeoutMs: MINUTE, intervalMs: 5, checkPaths: [], fetch });

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("readCliEnv", () => {
  const valid = { DEPLOY_URL: BASE, EXPECTED_VERSION: SHA, WAIT_TIMEOUT_MINUTES: "8" };

  it("reads the URL, the expected SHA and the timeout in minutes", () => {
    expect(readCliEnv(valid)).toEqual({ baseUrl: `${BASE}/`, expectedVersion: SHA, timeoutMs: 8 * MINUTE });
  });

  it.each([
    [{ DEPLOY_URL: undefined }, /DEPLOY_URL must be an absolute https URL, got ""/],
    [{ DEPLOY_URL: "deploy-preview-7" }, /DEPLOY_URL must be an absolute https URL/],
    [{ DEPLOY_URL: "http://example.com" }, /DEPLOY_URL must be an absolute https URL, got "http:\/\/example.com"/],
    [{ EXPECTED_VERSION: undefined }, /EXPECTED_VERSION must be a commit SHA, got ""/],
    [{ EXPECTED_VERSION: "main" }, /EXPECTED_VERSION must be a commit SHA/],
    [{ WAIT_TIMEOUT_MINUTES: undefined }, /WAIT_TIMEOUT_MINUTES must be a positive number, got ""/],
    [{ WAIT_TIMEOUT_MINUTES: "0" }, /WAIT_TIMEOUT_MINUTES must be a positive number/],
    [{ WAIT_TIMEOUT_MINUTES: "soon" }, /WAIT_TIMEOUT_MINUTES must be a positive number/],
  ])("rejects %j", (override, message) => {
    expect(() => readCliEnv({ ...valid, ...override })).toThrow(message);
  });
});

describe("main (the CLI)", () => {
  const env = { DEPLOY_URL: BASE, EXPECTED_VERSION: SHA, WAIT_TIMEOUT_MINUTES: "8" };
  const logger = () => ({ log: vi.fn(), error: vi.fn() });

  it("exits 0 once the deploy is live", async () => {
    const log = logger();
    const deploy = fakeDeploy([health(SHA)]);

    expect(await main(env, log, deploy.options)).toBe(0);
    expect(log.error).not.toHaveBeenCalled();
    expect(log.log).toHaveBeenLastCalledWith(expect.stringContaining(`serves ${SHA}`));
  });

  it("exits 1 with a GitHub error annotation when the deploy never becomes ready", async () => {
    const log = logger();
    const deploy = fakeDeploy([status(404)]);

    expect(await main(env, log, deploy.options)).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/^::error::.*did not report version .* within 8 minutes/));
  });

  it("exits 1 with a GitHub error annotation on invalid input, before any request", async () => {
    const log = logger();
    const deploy = fakeDeploy([health(SHA)]);

    expect(await main({ ...env, EXPECTED_VERSION: "" }, log, deploy.options)).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/^::error::EXPECTED_VERSION must be a commit SHA/));
    expect(deploy.fetch).not.toHaveBeenCalled();
  });

  it("exits the process with 1 and an annotation when run as a script with bad input", () => {
    const run = spawnSync(process.execPath, [join(repoRoot, "scripts", "wait-for-deploy.mjs")], {
      encoding: "utf8",
      env: { ...process.env, DEPLOY_URL: "http://insecure.example", EXPECTED_VERSION: SHA, WAIT_TIMEOUT_MINUTES: "1" },
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("::error::DEPLOY_URL must be an absolute https URL");
  });

  it("reports a non-Error failure as text", async () => {
    const log = logger();
    const fetch = vi.fn(async () => health(SHA));
    const failingNow = () => {
      throw "clock broke";
    };

    expect(await main(env, log, { fetch, now: failingNow })).toBe(1);
    expect(log.error).toHaveBeenCalledWith("::error::clock broke");
  });
});
