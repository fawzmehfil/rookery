import { describe, expect, expectTypeOf, it } from "vitest";
import {
  coordinateToSquare,
  parseVariantDefinition,
  squareToCoordinate,
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

describe("variant contracts", () => {
  it("parses a structurally valid variant", () => {
    const result = parseVariantDefinition(validVariant);

    expect(result).toEqual({ ok: true, value: validVariant });
    if (result.ok) expectTypeOf(result.value).toMatchTypeOf<VariantDefinition>();
  });

  it.each([
    ["unsupported schema version", { ...validVariant, schemaVersion: 2 }],
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

  it("exports the complete engine interface", () => {
    expectTypeOf<RulesEngine>().toHaveProperty("createInitialState");
    expectTypeOf<RulesEngine>().toHaveProperty("getLegalActions");
    expectTypeOf<RulesEngine>().toHaveProperty("applyAction");
    expectTypeOf<RulesEngine>().toHaveProperty("evaluateOutcome");
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
