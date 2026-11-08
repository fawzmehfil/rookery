import { describe, expect, it } from "vitest";
import { createInitialState, parseVariantDefinition, validateVariantDefinition } from "../index";
import {
  lastFlockStandingVariant,
  lastFlockStandingVariantJson,
  lastFlockStandingVariantSource,
  longWalkVariant,
  longWalkVariantJson,
  longWalkVariantSource,
} from "./index";

describe("Sprint 2 fixtures", () => {
  it.each([
    ["The Long Walk", longWalkVariantSource, longWalkVariant, longWalkVariantJson],
    ["Last Flock Standing", lastFlockStandingVariantSource, lastFlockStandingVariant, lastFlockStandingVariantJson],
  ])("parses and round-trips %s as current serialized data", (_name, source, variant, json) => {
    expect(parseVariantDefinition(source)).toEqual({ ok: true, value: variant });
    expect(parseVariantDefinition(JSON.parse(json))).toEqual({ ok: true, value: variant });
    expect(validateVariantDefinition(source)).toEqual([]);
    expect(createInitialState(variant).ok).toBe(true);
  });

  it("defines mirrored action-required targets for The Long Walk", () => {
    expect(longWalkVariant.objectives).toEqual([
      {
        type: "reach-target",
        requireAction: true,
        targets: [
          { playerId: "white", cells: [{ file: 0, rank: 2 }], eligiblePieceTypeIds: ["runner"] },
          { playerId: "black", cells: [{ file: 2, rank: 0 }], eligiblePieceTypeIds: ["runner"] },
        ],
      },
    ]);
    expect(longWalkVariant.pieceTypes[0]?.movements[0]).toMatchObject({
      kind: "step",
      frame: "owner",
      offsets: [{ fileDelta: 0, rankDelta: 1 }],
    });
  });

  it("uses ordinary compound, leaper, and rider data in Last Flock Standing", () => {
    expect(lastFlockStandingVariant.objectives).toEqual([{ type: "eliminate-all" }]);
    expect(lastFlockStandingVariant.pieceTypes.map(({ id }) => id)).toEqual([
      "tower",
      "chancellor",
      "camel",
      "nightrider",
    ]);
    expect(lastFlockStandingVariant.pieceTypes.map(({ movements }) => movements.map(({ kind }) => kind))).toEqual([
      ["slide"],
      ["slide", "leap"],
      ["leap"],
      ["slide"],
    ]);
  });
});
