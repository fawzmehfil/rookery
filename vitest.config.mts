import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    // Full-workflow UI tests run several times slower when every jsdom file runs in
    // parallel (about 2 s alone, near 5 s in the full suite). Match the 15 s budget the
    // Sprint 2 integration test already uses so shared CI runners do not flake.
    testTimeout: 15_000,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
