import { defineConfig } from "vitest/config";

// Inspects the output of `next build`; run through `npm run test:build`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/build/**/*.test.ts"],
  },
});
