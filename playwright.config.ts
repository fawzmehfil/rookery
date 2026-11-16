import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the local production server (`npm run build` first),
// so CI never depends on a hosted preview. Set ROOKERY_E2E_BASE_URL to point the
// same tests at a deployed preview by hand; no local server is started then.
const port = Number(process.env.ROOKERY_E2E_PORT ?? 3200);
const hostedURL = process.env.ROOKERY_E2E_BASE_URL;
const baseURL = hostedURL ?? `http://127.0.0.1:${port}`;

// Screenshots and the backup recording are optional evidence, kept apart from
// the release-gate tests. `npm run evidence:capture` turns them on.
const capturingEvidence = process.env.ROOKERY_EVIDENCE === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: capturingEvidence ? "evidence/**/*.capture.ts" : "**/*.spec.ts",
  outputDir: "./test-results",
  fullyParallel: !capturingEvidence,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: capturingEvidence ? { mode: "on", size: { width: 1280, height: 720 } } : "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-narrow", use: { ...devices["Pixel 7"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: hostedURL
    ? undefined
    : {
        command: "npm start",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: { HOSTNAME: "127.0.0.1", PORT: String(port), NODE_ENV: "production" },
      },
});
