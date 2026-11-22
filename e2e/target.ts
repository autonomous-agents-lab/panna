/** Tests that need /test-only/* routes. Those are never turned on in a deploy, so remote runs skip them. */
export const TEST_ROUTES_TAG = "@test-routes";

export type E2eTarget = {
  baseURL: string;
  /** How to start the app locally; absent when testing a deploy that is already running. */
  webServer?: { command: string; url: string; env: Record<string, string> };
  grepInvert?: RegExp;
};

/**
 * Where Playwright points: a deployed site when PLAYWRIGHT_BASE_URL is set (e.g. a Deploy
 * Preview in CI), otherwise a production build it starts itself on E2E_PORT (default 3100).
 */
export function resolveTarget(env: Record<string, string | undefined>): E2eTarget {
  const remote = env.PLAYWRIGHT_BASE_URL;
  if (remote) {
    let url: URL;
    try {
      url = new URL(remote);
    } catch {
      throw new Error(`PLAYWRIGHT_BASE_URL must be an absolute https URL, got ${JSON.stringify(remote)}`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`PLAYWRIGHT_BASE_URL must be an absolute https URL, got ${JSON.stringify(remote)}`);
    }
    return { baseURL: url.origin, grepInvert: new RegExp(TEST_ROUTES_TAG) };
  }

  const port = Number(env.E2E_PORT ?? 3100);
  const baseURL = `http://localhost:${port}`;
  return {
    baseURL,
    webServer: {
      // Always the production build: the dev error overlay traps focus on pages that throw, which
      // would hide what users really get from the error page (keyboard and axe checks).
      command: `npm run build && npm run start -- --port ${port}`,
      url: baseURL,
      // Turns on /test-only/* (a route that throws, for the error page tests). Never set in Netlify.
      env: { ENABLE_TEST_ROUTES: "true" },
    },
  };
}
