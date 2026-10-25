import { describe, expect, it } from "vitest";
import { createInitialState } from "../create-initial-state";
import { firstFlightVariant } from "../fixtures";
import type { ApplyActionResult, GameState, MoveAction, VariantDefinition } from "../types";
import { applyConfirmedAction } from "./apply-confirmed-action";

describe("applyConfirmedAction", () => {
  it("moves a confirmed piece, advances the turn, and emits ordered events", () => {
    const initial = initialState();
    const result = applyConfirmedAction(firstFlightVariant, initial, move("white-tower", 0, 3));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.state).toMatchObject({ ply: 1, activePlayerId: "black", outcome: null });
    expect(result.value.state.pieces.find(({ id }) => id === "white-tower")?.at).toEqual({ file: 0, rank: 3 });
    expect(result.value.events.map(({ type }) => type)).toEqual(["piece-moved", "turn-changed"]);
    expect(initial.ply).toBe(0);
    expect(initial.pieces.find(({ id }) => id === "white-tower")?.at).toEqual({ file: 0, rank: 0 });
    expect(Object.isFrozen(result.value.state)).toBe(true);
    expect(Object.isFrozen(result.value.events)).toBe(true);
  });

  it("removes an opposing piece and emits capture before the turn changes", () => {
    let state = initialState();
    state = apply(state, move("white-tower", 0, 3));
    state = apply(state, move("black-hopper", 1, 2));
    state = apply(state, move("white-tower", 1, 3));
    state = apply(state, move("black-tower", 4, 1));

    const result = applyConfirmedAction(firstFlightVariant, state, move("white-tower", 1, 2));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.state.pieces.some(({ id }) => id === "black-hopper")).toBe(false);
    expect(result.value.events.map(({ type }) => type)).toEqual([
      "piece-moved",
      "piece-captured",
      "turn-changed",
    ]);
  });

  it("is deterministic for identical inputs", () => {
    const state = initialState();
    const action = move("white-tower", 0, 3);

    expect(applyConfirmedAction(firstFlightVariant, state, action)).toEqual(
      applyConfirmedAction(firstFlightVariant, state, action),
    );
  });

  it.each([
    ["PIECE_NOT_FOUND", move("unknown", 0, 1)],
    ["NOT_ACTIVE_PLAYER", move("black-tower", 4, 3)],
    ["SAME_SQUARE", move("white-tower", 0, 0)],
    ["DESTINATION_OUT_OF_BOUNDS", move("white-tower", 5, 0)],
    ["DESTINATION_OCCUPIED_BY_ALLY", move("white-tower", 2, 0)],
  ])("returns %s without changing state", (code, action) => {
    const state = initialState();
    const before = JSON.stringify(state);
    const result = applyConfirmedAction(firstFlightVariant, state, action);

    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects disabled destinations", () => {
    const variant: VariantDefinition = {
      ...firstFlightVariant,
      board: { ...firstFlightVariant.board, disabledCells: [{ file: 0, rank: 1 }] },
    };

    expect(applyConfirmedAction(variant, initialState(), move("white-tower", 0, 1))).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_DISABLED" },
    });
  });

  it("rejects states for a different variant and finished games", () => {
    const state = initialState();
    const differentVariant: VariantDefinition = { ...firstFlightVariant, id: "different" };

    expect(applyConfirmedAction(differentVariant, state, move("white-tower", 0, 3))).toMatchObject({
      ok: false,
      error: { code: "INVALID_VARIANT" },
    });

    const finished: GameState = {
      ...state,
      activePlayerId: null,
      outcome: {
        type: "win",
        reason: "capture-royal",
        winnerPlayerId: "white",
        loserPlayerId: "black",
        capturedPieceId: "black-sovereign",
      },
    };

    expect(applyConfirmedAction(firstFlightVariant, finished, move("white-tower", 0, 3))).toMatchObject({
      ok: false,
      error: { code: "GAME_ALREADY_ENDED" },
    });
  });
});

function initialState(): GameState {
  const result = createInitialState(firstFlightVariant);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function apply(state: GameState, action: MoveAction): GameState {
  const result: ApplyActionResult = applyConfirmedAction(firstFlightVariant, state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

function move(pieceId: string, file: number, rank: number): MoveAction {
  return { type: "move", pieceId, to: { file, rank } };
}
