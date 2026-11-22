import { test as base } from "@playwright/test";

import { isHostTooling, resolveTarget } from "./target";

export { expect } from "@playwright/test";

const target = resolveTarget(process.env);

/**
 * Playwright's `test`, with host tooling (the Deploy Preview toolbar) answered by an empty script,
 * so it never loads, takes focus or logs errors. Tests see only what the app itself does.
 */
export const test = base.extend<{ stubHostTooling: void }>({
  stubHostTooling: [
    async ({ context }, use) => {
      await context.route(
        (url) => isHostTooling(url.href, target),
        (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
      );
      await use();
    },
    { auto: true },
  ],
});
