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
}) {
  const healthUrl = new URL("/api/health", baseUrl).href;
  const startedAt = now();
  let lastSeen = "no response yet";

  for (;;) {
    try {
      const { version, seen } = await describeHealth(await get(fetchImpl, healthUrl));
      if (version === expectedVersion) break;
      lastSeen = seen;
    } catch (error) {
      lastSeen = `network error (${error instanceof Error ? error.message : String(error)})`;
    }

    const elapsed = now() - startedAt;
    if (elapsed >= timeoutMs) {
      throw new Error(
        `${healthUrl} did not report version ${expectedVersion} within ${timeoutMs / MINUTE_MS} minutes ` +
          `(last seen: ${lastSeen}). The deploy failed, is still building or is queued behind another ` +
          "build: check it in Netlify, then re-run this job.",
      );
    }
    await sleep(Math.min(intervalMs, timeoutMs - elapsed));
  }

  for (const path of checkPaths) {
    const url = new URL(path, baseUrl).href;
    const response = await get(fetchImpl, url);
    if (response.status !== 200) {
      throw new Error(`${url} answered HTTP ${response.status} on version ${expectedVersion}; expected 200.`);
    }
  }
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
    await waitForDeploy({ ...options, ...target });
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
