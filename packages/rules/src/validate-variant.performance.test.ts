import { cpus, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { validateVariantDefinition } from "./index";

function maximumReachTargetFixture() {
  const cells = Array.from({ length: 26 * 26 }, (_, index) => ({
    file: index % 26,
    rank: Math.floor(index / 26),
  }));
  const pieceTypes = Array.from({ length: 128 }, (_, index) => ({
    id: `type-${index}`,
    name: `Type ${index}`,
    royal: false,
    movements: [{
      kind: "step" as const,
      frame: "board" as const,
      mode: "move-or-capture" as const,
      offsets: [
        { fileDelta: -1, rankDelta: 0 },
        { fileDelta: 1, rankDelta: 0 },
        { fileDelta: 0, rankDelta: -1 },
        { fileDelta: 0, rankDelta: 1 },
      ],
    }],
  }));
  const setup = cells.map((at, index) => ({
    id: `piece-${index}`,
    typeId: pieceTypes[index % pieceTypes.length]!.id,
    ownerId: index % 2 === 0 ? "white" : "black",
    at,
  }));

  return {
    schemaVersion: 2,
    id: "maximum-reach-target",
    name: "Maximum reach-target fixture",
    board: { files: 26, ranks: 26, disabledCells: [] },
    players: [
      { id: "white", name: "White", forwardRank: 1 },
      { id: "black", name: "Black", forwardRank: -1 },
    ],
    turnOrder: ["white", "black"],
    pieceTypes,
    setup,
    objectives: [{
      type: "reach-target",
      requireAction: true,
      targets: [
        {
          playerId: "white",
          cells: cells.filter((_, index) => index % 2 === 1),
          eligiblePieceTypeIds: pieceTypes.map(({ id }) => id),
        },
        {
          playerId: "black",
          cells: cells.filter((_, index) => index % 2 === 0),
          eligiblePieceTypeIds: pieceTypes.map(({ id }) => id),
        },
      ],
    }],
  };
}

it.skipIf(process.env.ROOKERY_PERF !== "1")(
  "validates a maximum-size reach-target definition within the 100ms PoC budget",
  () => {
    const variant = maximumReachTargetFixture();
    expect(validateVariantDefinition(variant)).toEqual([]);

    for (let index = 0; index < 10; index += 1) validateVariantDefinition(variant);

    const samples = Array.from({ length: 9 }, () => {
      const start = performance.now();
      for (let index = 0; index < 10; index += 1) validateVariantDefinition(variant);
      return (performance.now() - start) / 10;
    }).sort((left, right) => left - right);

    console.info(JSON.stringify({
      node: process.version,
      os: `${platform()} ${release()}`,
      cpu: cpus()[0]?.model,
      fixture: "128 types and 676 pieces/targets on 26x26",
      warmup: 10,
      callsPerSample: 10,
      samplesMs: samples,
      medianMs: samples[4],
    }));
    expect(samples[4]).toBeLessThanOrEqual(100);
  },
);
