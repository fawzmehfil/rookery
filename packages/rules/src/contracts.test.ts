import { describe, expect, expectTypeOf, it } from "vitest";
import {
  coordinateToSquare,
  parseVariantDefinition,
  squareToCoordinate,
  type CurrentVariantDefinition,
  type EliminateAllWinOutcome,
  type ReachTargetWinOutcome,
  type RulesEngine,
  type VariantDefinition,
} from "./index";

const validVariant = {
  schemaVersion: 1,
  id: "contract-test",
  name: "Contract Test",
  board: { files: 5, ranks: 5, disabledCells: [] },
  players: [
    { id: "white", name: "White", forwardRank: 1 },
    { id: "black", name: "Black", forwardRank: -1 },
  ],
  turnOrder: ["white", "black"],
  pieceTypes: [
    {
      id: "royal",
      name: "Royal",
      royal: true,
      movements: [
        {
          kind: "step",
          frame: "owner",
          mode: "move-or-capture",
          offsets: [{ fileDelta: 0, rankDelta: 1 }],
        },
      ],
    },
  ],
  setup: [
    { id: "white-royal", typeId: "royal", ownerId: "white", at: { file: 2, rank: 0 } },
    { id: "black-royal", typeId: "royal", ownerId: "black", at: { file: 2, rank: 4 } },
  ],
  objectives: [{ type: "capture-royal" }],
} as const;

const validCurrentVariant = {
  ...validVariant,
  schemaVersion: 2,
  objectives: [
    {
      type: "reach-target",
      requireAction: true,
      targets: [
        { playerId: "white", cells: [{ file: 2, rank: 4 }], eligiblePieceTypeIds: ["royal"] },
        { playerId: "black", cells: [{ file: 2, rank: 0 }], eligiblePieceTypeIds: ["royal"] },
      ],
    },
  ],
} as const;

describe("variant contracts", () => {
  it("parses a structurally valid variant", () => {
    const result = parseVariantDefinition(validVariant);

    expect(result).toEqual({ ok: true, value: validVariant });
    if (result.ok) expectTypeOf(result.value).toMatchTypeOf<VariantDefinition>();
  });

  it("parses each current objective through the version 2 contract", () => {
    const objectiveSources = [
      [{ type: "capture-royal" }],
      validCurrentVariant.objectives,
      [{ type: "eliminate-all" }],
    ] as const;

    for (const objectives of objectiveSources) {
      const result = parseVariantDefinition({ ...validCurrentVariant, objectives });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.schemaVersion).toBe(2);
    }
  });

  it("normalizes the reach-target action requirement without changing version 1 input", () => {
    const withoutRequirement = {
      ...validCurrentVariant,
      objectives: [
        {
          type: "reach-target",
          targets: validCurrentVariant.objectives[0].targets,
        },
      ],
    };

    const currentResult = parseVariantDefinition(withoutRequirement);
    expect(currentResult.ok).toBe(true);
    if (currentResult.ok) {
      expect(currentResult.value.objectives[0]).toMatchObject({ requireAction: true });
      expectTypeOf(currentResult.value).toMatchTypeOf<VariantDefinition>();
    }

    expect(parseVariantDefinition(validVariant)).toEqual({ ok: true, value: validVariant });
  });

  it.each([
    ["unsupported schema version", { ...validVariant, schemaVersion: 3 }],
    ["version 1 with a current objective", { ...validVariant, objectives: [{ type: "eliminate-all" }] }],
    ["unknown objective", { ...validCurrentVariant, objectives: [{ type: "survive" }] }],
    [
      "reach-target without two player entries",
      {
        ...validCurrentVariant,
        objectives: [
          {
            ...validCurrentVariant.objectives[0],
            targets: validCurrentVariant.objectives[0].targets.slice(0, 1),
          },
        ],
      },
    ],
    ["wrong player count", { ...validVariant, players: validVariant.players.slice(0, 1) }],
    ["oversized board", { ...validVariant, board: { files: 27, ranks: 5, disabledCells: [] } }],
    [
      "zero movement vector",
      {
        ...validVariant,
        pieceTypes: [
          {
            ...validVariant.pieceTypes[0],
            movements: [
              {
                kind: "leap",
                frame: "board",
                mode: "move-or-capture",
                offsets: [{ fileDelta: 0, rankDelta: 0 }],
              },
            ],
          },
        ],
      },
    ],
  ])("rejects %s", (_name, input) => {
    expect(parseVariantDefinition(input).ok).toBe(false);
  });

  it("round-trips a variant through JSON", () => {
    const result = parseVariantDefinition(JSON.parse(JSON.stringify(validVariant)));

    expect(result).toEqual({ ok: true, value: validVariant });
  });

  it("normalizes optional board and piece fields", () => {
    const input = {
      ...validVariant,
      board: {
        files: validVariant.board.files,
        ranks: validVariant.board.ranks,
      },
      pieceTypes: [
        {
          id: validVariant.pieceTypes[0].id,
          name: validVariant.pieceTypes[0].name,
          movements: validVariant.pieceTypes[0].movements,
        },
      ],
    };

    const result = parseVariantDefinition(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.board.disabledCells).toEqual([]);
    expect(result.value.pieceTypes[0]?.royal).toBe(false);
  });

  it("exports the complete engine interface", () => {
    expectTypeOf<RulesEngine>().toHaveProperty("createInitialState");
    expectTypeOf<RulesEngine>().toHaveProperty("getLegalActions");
    expectTypeOf<RulesEngine>().toHaveProperty("applyAction");
    expectTypeOf<RulesEngine>().toHaveProperty("evaluateOutcome");
  });

  it("exports current variant and outcome contracts for downstream implementations", () => {
    expectTypeOf(validCurrentVariant).toMatchTypeOf<CurrentVariantDefinition>();
    expectTypeOf<ReachTargetWinOutcome>().toHaveProperty("target");
    expectTypeOf<EliminateAllWinOutcome>().toHaveProperty("capturedPieceId");
  });
});

describe("coordinate boundary helpers", () => {
  it("formats and parses the supported coordinate range", () => {
    expect(coordinateToSquare({ file: 0, rank: 0 })).toBe("a1");
    expect(coordinateToSquare({ file: 25, rank: 25 })).toBe("z26");
    expect(squareToCoordinate("E5")).toEqual({ file: 4, rank: 4 });
  });

  it("rejects malformed or unsupported coordinates", () => {
    expect(squareToCoordinate("aa1")).toBeNull();
    expect(squareToCoordinate("a0")).toBeNull();
    expect(squareToCoordinate("a27")).toBeNull();
    expect(() => coordinateToSquare({ file: 26, rank: 0 })).toThrow(RangeError);
  });
});
