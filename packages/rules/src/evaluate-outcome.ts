import type { GameOutcome, GameState, VariantDefinition } from "./types";

export function evaluateOutcome(variant: VariantDefinition, state: GameState): GameOutcome | null {
  if (state.outcome) return state.outcome;

  const royalTypeIds = new Set(variant.pieceTypes.filter(({ royal }) => royal).map(({ id }) => id));
  const missingRoyals = variant.players.flatMap(({ id: playerId }) => {
    const royalPlacement = variant.setup.find(
      ({ ownerId, typeId }) => ownerId === playerId && royalTypeIds.has(typeId),
    );

    if (!royalPlacement) return [];

    const royalIsPresent = state.pieces.some(({ id }) => id === royalPlacement.id);
    return royalIsPresent ? [] : [{ playerId, pieceId: royalPlacement.id }];
  });

  if (missingRoyals.length !== 1) return null;

  const capturedRoyal = missingRoyals[0];
  const winner = variant.players.find(({ id }) => id !== capturedRoyal?.playerId);

  if (!capturedRoyal || !winner) return null;

  return Object.freeze({
    type: "win",
    reason: "capture-royal",
    winnerPlayerId: winner.id,
    loserPlayerId: capturedRoyal.playerId,
    capturedPieceId: capturedRoyal.pieceId,
  });
}
