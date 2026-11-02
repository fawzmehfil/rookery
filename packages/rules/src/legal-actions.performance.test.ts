import { cpus, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { createInitialState, getLegalActions } from "./index";
import { firstFlightVariant } from "./fixtures";

it.skipIf(process.env.ROOKERY_PERF !== "1")("generates legal actions within the 100ms PoC budget", () => {
  const variant = { ...firstFlightVariant, board: { files: 26, ranks: 26, disabledCells: [] } };
  const initial = createInitialState(variant);
  if (!initial.ok) throw new Error("Invalid performance fixture");
  for (let i = 0; i < 100; i++) getLegalActions(variant, initial.value);
  const samples = Array.from({ length: 9 }, () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) getLegalActions(variant, initial.value);
    return (performance.now() - start) / 100;
  }).sort((a, b) => a - b);
  console.info(JSON.stringify({ node: process.version, os: `${platform()} ${release()}`, cpu: cpus()[0]?.model,
    fixture: "First Flight pieces on 26x26", warmup: 100, callsPerSample: 100, samplesMs: samples, medianMs: samples[4] }));
  expect(samples[4]).toBeLessThanOrEqual(100);
});
