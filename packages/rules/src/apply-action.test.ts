import { describe, expect, it } from "vitest";
import { firstFlightDemonstration, firstFlightVariant } from "./fixtures";
import { applyAction, createInitialState } from "./index";
import type { GameState, MoveAction } from "./types";

describe("applyAction", () => {
  it("applies an action only when it exactly matches the public legal-action set", () => {
    const initial = initialState();
    const result = applyAction(firstFlightVariant, initial, firstFlightDemonstration[0]);

    expect(result).toMatchObject({
      ok: true,
      value: {
        state: { ply: 1, activePlayerId: "black" },
        events: [{ type: "piece-moved" }, { type: "turn-changed" }],
      },
    });
    expect(initial).toEqual(initialState());
  });

  it("rejects a movement-illegal action with structured details and leaves state unchanged", () => {
    const initial = initialState();
    const snapshot = structuredClone(initial);
    const result = applyAction(firstFlightVariant, initial, move("white-tower", 1, 1));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ACTION_NOT_LEGAL",
        message: "The proposed action is not legal in the current position.",
        details: { pieceId: "white-tower", destinationFile: 1, destinationRank: 1 },
      },
    });
    expect(initial).toEqual(snapshot);
  });

  it.each([
    ["PIECE_NOT_FOUND", move("missing", 0, 1)],
    ["NOT_ACTIVE_PLAYER", move("black-tower", 4, 3)],
    ["SAME_SQUARE", move("white-tower", 0, 0)],
    ["DESTINATION_OUT_OF_BOUNDS", move("white-tower", 5, 0)],
    ["DESTINATION_OCCUPIED_BY_ALLY", move("white-tower", 2, 0)],
  ])("preserves the transition kernel's %s error", (code, action) => {
    expect(applyAction(firstFlightVariant, initialState(), action)).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it("completes First Flight through the safe public path deterministically", () => {
    const run = () => {
      let state = initialState();
      const events = [];

      for (const action of firstFlightDemonstration) {
        const result = applyAction(firstFlightVariant, state, action);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.error.message);
        state = result.value.state;
        events.push(...result.value.events);
      }

      return { state, events };
    };

    const first = run();
    expect(run()).toEqual(first);
    expect(first.state).toMatchObject({
      ply: 9,
      activePlayerId: null,
      outcome: { type: "win", winnerPlayerId: "white", capturedPieceId: "black-sovereign" },
    });
    expect(applyAction(firstFlightVariant, first.state, firstFlightDemonstration[0])).toMatchObject({
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

function move(pieceId: string, file: number, rank: number): MoveAction {
  return { type: "move", pieceId, to: { file, rank } };
}
