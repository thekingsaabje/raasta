import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so the Cloudflare plugin is not loaded for Node-based tests.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    environment: "node",
  },
});
