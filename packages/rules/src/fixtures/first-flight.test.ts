import { describe, expect, it } from "vitest";
import { parseVariantDefinition } from "../parse";
import {
  firstFlightDemonstration,
  firstFlightVariant,
  firstFlightVariantJson,
  firstFlightVariantSource,
} from "./first-flight";

describe("First Flight", () => {
  it("is a valid serialized 5x5 capture-the-royal variant", () => {
    expect(parseVariantDefinition(firstFlightVariantSource)).toEqual({
      ok: true,
      value: firstFlightVariant,
    });
    expect(parseVariantDefinition(JSON.parse(firstFlightVariantJson))).toEqual({
      ok: true,
      value: firstFlightVariant,
    });
    expect(firstFlightVariant.board).toMatchObject({ files: 5, ranks: 5 });
    expect(firstFlightVariant.objectives).toEqual([{ type: "capture-royal" }]);
  });

  it("contains one royal, slider, and leaper for each player", () => {
    expect(firstFlightVariant.pieceTypes.map(({ id }) => id)).toEqual(["sovereign", "tower", "hopper"]);
    expect(firstFlightVariant.setup).toHaveLength(6);
    expect(firstFlightVariant.setup.filter(({ typeId }) => typeId === "sovereign")).toHaveLength(2);
    expect(firstFlightVariant.setup.filter(({ typeId }) => typeId === "tower")).toHaveLength(2);
    expect(firstFlightVariant.setup.filter(({ typeId }) => typeId === "hopper")).toHaveLength(2);
  });

  it("provides a deterministic demonstration ending in royal capture", () => {
    expect(firstFlightDemonstration).toHaveLength(9);
    expect(firstFlightDemonstration.at(-1)).toEqual({
      type: "move",
      pieceId: "white-tower",
      to: { file: 1, rank: 4 },
    });
  });
});
