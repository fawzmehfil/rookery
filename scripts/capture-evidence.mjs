import { spawnSync } from "node:child_process";

// Captures the optional Sprint 2 screenshots and backup recording.
// Kept out of `npm run test:e2e` so the release gate stays deterministic.
const result = spawnSync("npx", ["playwright", "test", "--project=chromium", "--project=chromium-narrow"], {
  env: { ...process.env, ROOKERY_EVIDENCE: "1" },
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
