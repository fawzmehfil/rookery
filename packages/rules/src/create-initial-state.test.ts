import { describe, expect, it } from "vitest";
import { firstFlightVariant } from "./fixtures";
import { createInitialState } from "./create-initial-state";
import type { VariantDefinition } from "./types";

describe("createInitialState", () => {
  it("creates a deterministic, immutable copy of the canonical setup", () => {
    const first = createInitialState(firstFlightVariant);
    const second = createInitialState(firstFlightVariant);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);

    if (!first.ok) return;

    expect(first.value).toMatchObject({
      variantId: "first-flight",
      ply: 0,
      activePlayerId: "white",
      outcome: null,
    });
    expect(first.value.pieces).toHaveLength(6);
    expect(first.value.pieces[0]).not.toBe(firstFlightVariant.setup[0]);
    expect(Object.isFrozen(first.value)).toBe(true);
    expect(Object.isFrozen(first.value.pieces)).toBe(true);
    expect(Object.isFrozen(first.value.pieces[0]?.at)).toBe(true);
  });

  it.each([
    [
      "duplicate piece IDs",
      (variant: MutableVariant) => {
        variant.setup[1]!.id = variant.setup[0]!.id;
      },
    ],
    [
      "unknown piece types",
      (variant: MutableVariant) => {
        variant.setup[0]!.typeId = "unknown";
      },
    ],
    [
      "unknown owners",
      (variant: MutableVariant) => {
        variant.setup[0]!.ownerId = "unknown";
      },
    ],
    [
      "out-of-bounds placements",
      (variant: MutableVariant) => {
        variant.setup[0]!.at.file = 5;
      },
    ],
    [
      "disabled starting cells",
      (variant: MutableVariant) => {
        variant.board.disabledCells.push({ ...variant.setup[0]!.at });
      },
    ],
    [
      "multiple pieces on one cell",
      (variant: MutableVariant) => {
        variant.setup[1]!.at = { ...variant.setup[0]!.at };
      },
    ],
    [
      "incomplete turn order",
      (variant: MutableVariant) => {
        variant.turnOrder[1] = variant.turnOrder[0]!;
      },
    ],
    [
      "missing royals",
      (variant: MutableVariant) => {
        variant.setup = variant.setup.filter(({ id }) => id !== "black-sovereign");
      },
    ],
  ])("rejects %s", (_name, change) => {
    const variant = cloneVariant();
    change(variant);

    const result = createInitialState(variant as VariantDefinition);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_VARIANT");
  });
});

type MutableVariant = {
  -readonly [Key in keyof VariantDefinition]: Mutable<VariantDefinition[Key]>;
};

type Mutable<Value> = Value extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
    : Value;

function cloneVariant(): MutableVariant {
  return JSON.parse(JSON.stringify(firstFlightVariant)) as MutableVariant;
}
