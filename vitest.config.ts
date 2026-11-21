import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: [
        "src/config/**",
        "src/theme/**",
        "src/i18n/**",
        "src/components/**",
        "eslint-rules/**",
        "tests/guards/**",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.mts", "**/__fixtures__/**"],
    },
  },
});
