// Waits until a deploy serves the expected commit, then checks its key pages answer 200.
// CI runs it before testing a Deploy Preview and after a push to main. It needs no token: the
// deploy URL is predictable and /api/health reports the build's commit SHA.
import { pathToFileURL } from "node:url";

const MINUTE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(fetchImpl, url) {
  return fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function describeHealth(response) {
  if (!response.ok) return { seen: `HTTP ${response.status}` };
  const body = await response.json().catch(() => undefined);
  const version = typeof body?.version === "string" ? body.version : undefined;
  return { version, seen: version ? `version ${version}` : "HTTP 200 without a version" };
}

export async function waitForDeploy({
  baseUrl,
  expectedVersion,
  timeoutMs,
  intervalMs = 10_000,
  checkPaths = ["/", "/api/health"],
  fetch: fetchImpl = globalThis.fetch,
  now = Date.now,
  sleep = defaultSleep,
  warn = console.warn,
}) {
  const healthUrl = new URL("/api/health", baseUrl).href;
  const startedAt = now();
  let lastSeen = "no response yet";
  // Whether /api/health reported the expected version on the latest attempt.
  let live = false;

  for (;;) {
    live = false;
    try {
      const { version, seen } = await describeHealth(await get(fetchImpl, healthUrl));
      lastSeen = seen;
      live = version === expectedVersion;
      // A just-published deploy can briefly answer 404 on paths it serves, so the key pages are
      // polled to the same deadline as the version rather than failing on their first answer.
      if (live) {
        lastSeen = await firstPageNotOk(fetchImpl, baseUrl, checkPaths, warn);
        if (!lastSeen) return;
      }
    } catch (error) {
      lastSeen = `network error (${error instanceof Error ? error.message : String(error)})`;
    }

    const elapsed = now() - startedAt;
    if (elapsed >= timeoutMs) {
      const minutes = timeoutMs / MINUTE_MS;
      throw new Error(
        live
          ? `${baseUrl} serves ${expectedVersion}, but its key pages did not all answer 200 within ${minutes} ` +
              `minutes (last seen: ${lastSeen}).`
          : `${healthUrl} did not report version ${expectedVersion} within ${minutes} minutes ` +
              `(last seen: ${lastSeen}). The deploy failed, is still building or is queued behind another ` +
              "build: check it in Netlify, then re-run this job.",
      );
    }
    await sleep(Math.min(intervalMs, timeoutMs - elapsed));
  }
}

/**
 * The first key page that doesn't answer 200, described, or undefined when they all do. Each
 * such answer is also warned about, so a flaky route that recovers before the deadline still
 * leaves a trace on the run instead of passing unseen.
 */
async function firstPageNotOk(fetchImpl, baseUrl, paths, warn) {
  for (const path of paths) {
    const url = new URL(path, baseUrl).href;
    const response = await get(fetchImpl, url);
    if (response.status !== 200) {
      warn(`::warning::${await describeNotOk(url, response)}`);
      return `${url} answered HTTP ${response.status}`;
    }
  }
  return undefined;
}

/**
 * A non-200 key-page answer with what tells its source apart: an HTML page that loads the app's
 * Next.js assets is the app's own not-found page (a route matched wrongly), anything else came
 * from the host (the deploy isn't serving that path yet).
 */
async function describeNotOk(url, response) {
  const header = (name) => response.headers.get(name) ?? "none";
  const contentType = header("content-type");
  const body = await response.text().catch(() => "");
  const fromApp = contentType.startsWith("text/html") && body.includes("/_next/");
  const requestId = response.headers.get("x-nf-request-id") ?? header("x-request-id");
  return (
    `${url} answered HTTP ${response.status} (content-type: ${contentType}, cache-status: ${header("cache-status")}, ` +
    `request id: ${requestId}, app ${response.status === 404 ? "not-found " : ""}page: ${fromApp ? "yes" : "no"}).`
  );
}

/** Reads and validates the CLI's environment. Throws a message naming the bad variable. */
export function readCliEnv(env) {
  let baseUrl;
  try {
    baseUrl = new URL(env.DEPLOY_URL ?? "");
  } catch {
    throw new Error(`DEPLOY_URL must be an absolute https URL, got ${JSON.stringify(env.DEPLOY_URL ?? "")}.`);
  }
  if (baseUrl.protocol !== "https:") {
    throw new Error(`DEPLOY_URL must be an absolute https URL, got ${JSON.stringify(env.DEPLOY_URL)}.`);
  }
  const expectedVersion = env.EXPECTED_VERSION ?? "";
  if (!COMMIT_SHA.test(expectedVersion)) {
    throw new Error(`EXPECTED_VERSION must be a commit SHA, got ${JSON.stringify(expectedVersion)}.`);
  }
  const minutes = Number(env.WAIT_TIMEOUT_MINUTES);
  if (!(minutes > 0)) {
    throw new Error(
      `WAIT_TIMEOUT_MINUTES must be a positive number, got ${JSON.stringify(env.WAIT_TIMEOUT_MINUTES ?? "")}.`,
    );
  }
  return { baseUrl: baseUrl.href, expectedVersion, timeoutMs: minutes * MINUTE_MS };
}

/** Runs the wait from the environment and returns the process exit code. */
export async function main(env = process.env, log = console, options = {}) {
  try {
    const target = readCliEnv(env);
    log.log(`Waiting for ${target.baseUrl} to serve ${target.expectedVersion}...`);
    // `::warning::` lines go to the same log as the progress, where GitHub Actions annotates them.
    await waitForDeploy({ warn: (message) => log.log(message), ...options, ...target });
    log.log(`${target.baseUrl} serves ${target.expectedVersion}, and its key pages answer 200.`);
    return 0;
  } catch (error) {
    // `::error::` makes GitHub Actions show the message as an annotation on the run.
    log.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
