import { describe, expect, it } from "vitest";
import { createInitialState } from "./create-initial-state";
import { evaluateOutcome } from "./evaluate-outcome";
import { firstFlightDemonstration, firstFlightVariant } from "./fixtures";
import { applyConfirmedAction } from "./internal/apply-confirmed-action";
import type { GameState } from "./types";

describe("capture-the-royal", () => {
  it("has no outcome while both royals remain", () => {
    expect(evaluateOutcome(firstFlightVariant, initialState())).toBeNull();
  });

  it("derives the winner when one royal is absent", () => {
    const state = initialState();
    const withoutBlackRoyal: GameState = {
      ...state,
      pieces: state.pieces.filter(({ id }) => id !== "black-sovereign"),
    };

    expect(evaluateOutcome(firstFlightVariant, withoutBlackRoyal)).toEqual({
      type: "win",
      reason: "capture-royal",
      winnerPlayerId: "white",
      loserPlayerId: "black",
      capturedPieceId: "black-sovereign",
    });
  });

  it("ends First Flight on the final royal capture with ordered events", () => {
    let state = initialState();
    let finalEvents: readonly { readonly type: string }[] = [];

    for (const action of firstFlightDemonstration) {
      const result = applyConfirmedAction(firstFlightVariant, state, action);
      if (!result.ok) throw new Error(result.error.message);
      state = result.value.state;
      finalEvents = result.value.events;
    }

    expect(state).toMatchObject({
      ply: 9,
      activePlayerId: null,
      outcome: {
        type: "win",
        reason: "capture-royal",
        winnerPlayerId: "white",
        loserPlayerId: "black",
        capturedPieceId: "black-sovereign",
      },
    });
    expect(state.pieces.some(({ id }) => id === "black-sovereign")).toBe(false);
    expect(finalEvents.map(({ type }) => type)).toEqual(["piece-moved", "piece-captured", "game-ended"]);

    expect(applyConfirmedAction(firstFlightVariant, state, firstFlightDemonstration[0]!)).toMatchObject({
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
