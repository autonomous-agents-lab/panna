import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    // tests/build inspects `next build` output; it runs through `npm run test:build`.
    exclude: ["e2e/**", "node_modules/**", "tests/build/**"],
    coverage: {
      provider: "v8",
      include: ["src/config/**", "src/lib/**", "tests/guards/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/__fixtures__/**", "src/lib/supabase/database.types.ts"],
    },
  },
});
