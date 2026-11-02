import { expect, it } from "vitest";
import { createInitialState, evaluateOutcome, getLegalActions } from "./index";
import { firstFlightDemonstration, firstFlightVariant as variant } from "./fixtures";
import { applyConfirmedAction } from "./internal/apply-confirmed-action";

it("replays First Flight deterministically while preserving every state invariant", () => {
  const initial = createInitialState(variant);
  expect(initial.ok).toBe(true);
  if (!initial.ok) throw new Error("Invalid fixture");
  let state = initial.value;
  for (const action of firstFlightDemonstration) {
    const snapshot = JSON.stringify(state);
    const legal = getLegalActions(variant, state);
    expect(getLegalActions(variant, state)).toEqual(legal);
    expect(legal).toContainEqual(action);
    const result = applyConfirmedAction(variant, state, action);
    expect(applyConfirmedAction(variant, state, action)).toEqual(result);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Legal demonstration rejected");
    const previous = state;
    state = result.value.state;
    expect(state.ply).toBe(previous.ply + 1);
    expect(new Set(state.pieces.map(p => p.id)).size).toBe(state.pieces.length);
    for (const p of state.pieces) {
      expect(variant.players.some(player => player.id === p.ownerId)).toBe(true);
      expect(p.at.file).toBeGreaterThanOrEqual(0);
      expect(p.at.file).toBeLessThan(variant.board.files);
      expect(p.at.rank).toBeGreaterThanOrEqual(0);
      expect(p.at.rank).toBeLessThan(variant.board.ranks);
    }
    expect(new Set(state.pieces.map(p => `${p.at.file},${p.at.rank}`)).size).toBe(state.pieces.length);
    expect(Object.isFrozen(state)).toBe(true);
  }
  expect(state.outcome).toMatchObject({ type: "win", winnerPlayerId: "white" });
  expect(evaluateOutcome(variant, state)).toEqual(state.outcome);
  expect(getLegalActions(variant, state)).toEqual([]);
});

it("confirmed-kernel rejections leave the complete state unchanged", () => {
  const initial = createInitialState(variant);
  if (!initial.ok) throw new Error("Invalid fixture");
  for (const action of [
    { type: "move" as const, pieceId: "missing", to: { file: 1, rank: 1 } },
    { type: "move" as const, pieceId: "black-tower", to: { file: 1, rank: 1 } },
    { type: "move" as const, pieceId: "white-tower", to: { file: 25, rank: 25 } },
    { type: "move" as const, pieceId: "white-tower", to: { file: 0, rank: 0 } },
  ]) {
    const snapshot = structuredClone(initial.value);
    expect(applyConfirmedAction(variant, initial.value, action).ok).toBe(false);
    expect(initial.value).toEqual(snapshot);
  }
});
