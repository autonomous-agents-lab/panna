/** Tests that need /test-only/* routes. Those are never turned on in a deploy, so remote runs skip them. */
export const TEST_ROUTES_TAG = "@test-routes";

/**
 * Tests that sign in through local Supabase's mail inbox (Mailpit). A deploy uses the hosted
 * project, whose emails can't be read, so remote runs skip them.
 */
export const LOCAL_SUPABASE_TAG = "@local-supabase";

/**
 * Domains the Deploy Preview review toolbar loads from (its loader, its app and its analytics).
 * Netlify injects the toolbar into preview HTML only, never production. It takes focus and makes
 * third-party requests, so remote runs stub it out.
 */
export const PREVIEW_TOOLBAR_DOMAINS = ["netlify.app", "netlify.com", "segment.com", "segment.io"];

export type E2eTarget = {
  baseURL: string;
  /** How to start the app locally; absent when testing a deploy that is already running. */
  webServer?: { command: string; url: string; env: Record<string, string> };
  grepInvert?: RegExp;
  /** Requests to these domains (and their subdomains) come from the host, not the app. */
  hostToolingDomains: string[];
};

/** Whether `url` belongs to host tooling rather than the app: off the site's origin, on a tooling domain. */
export function isHostTooling(url: string, target: Pick<E2eTarget, "baseURL" | "hostToolingDomains">): boolean {
  const { origin, hostname } = new URL(url);
  return (
    origin !== new URL(target.baseURL).origin &&
    target.hostToolingDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  );
}

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
    return {
      baseURL: url.origin,
      grepInvert: new RegExp(`${TEST_ROUTES_TAG}|${LOCAL_SUPABASE_TAG}`),
      hostToolingDomains: PREVIEW_TOOLBAR_DOMAINS,
    };
  }

  const port = Number(env.E2E_PORT ?? 3100);
  const baseURL = `http://localhost:${port}`;
  return {
    baseURL,
    hostToolingDomains: [],
    webServer: {
      // Always the production build: the dev error overlay traps focus on pages that throw, which
      // would hide what users really get from the error page (keyboard and axe checks).
      command: `npm run build && npm run start -- --port ${port}`,
      url: baseURL,
      // Turns on /test-only/* (a route that throws, for the error page tests). Never set in Netlify.
      // The site URL is the server under test, so auth links come back to it rather than to a
      // dev server on another port (playwright.config.ts hands the tests the same value).
      env: { ENABLE_TEST_ROUTES: "true", NEXT_PUBLIC_SITE_URL: baseURL },
    },
  };
}
