import { defineConfig, devices } from "@playwright/test";

// BASE_URL=https://raasta.<account>.workers.dev npm run test:e2e  → runs the same journey against the deployed site.
const baseURL = process.env.BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // The seven journeys run once (desktop) to stay inside the live sign-up rate limit; the core journey runs on both.
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /journeys\.spec/ },
  ],
});
