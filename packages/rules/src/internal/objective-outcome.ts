import { freezeCoordinate } from "../create-initial-state";
import type {
  Coordinate,
  EngineResult,
  GameOutcome,
  GamePiece,
  GameState,
  ReachTargetObjective,
  VariantDefinition,
} from "../types";

/** The accepted action that produced a position, as seen by objective evaluation. */
export type AcceptedMove = Readonly<{
  piece: GamePiece;
  to: Coordinate;
  captured: GamePiece | null;
}>;

/**
 * The single outcome boundary for every objective kind.
 *
 * `position` is the state after the accepted action. `move` is that action, or
 * `null` when only a position is known; objectives that must be attributed to
 * an action (reach-target, eliminate-all) never infer a win without it.
 * Unsupported objectives are reported instead of silently continuing the game.
 */
export function evaluateObjectiveOutcome(
  variant: VariantDefinition,
  position: GameState,
  move: AcceptedMove | null,
): EngineResult<GameOutcome | null> {
  const objective = variant.objectives[0];

  if (!objective) return unsupportedObjective("missing");

  switch (objective.type) {
    case "capture-royal":
      return { ok: true, value: captureRoyalOutcome(variant, position) };
    case "reach-target":
      return { ok: true, value: move ? reachTargetOutcome(variant, objective, move) : null };
    case "eliminate-all":
      return { ok: true, value: move ? eliminateAllOutcome(position, move) : null };
    default: {
      // Adding an objective to the schema without handling it here fails to compile.
      const unhandled: never = objective;
      return unsupportedObjective(String((unhandled as { type?: unknown }).type));
    }
  }
}

function captureRoyalOutcome(variant: VariantDefinition, position: GameState): GameOutcome | null {
  const royalTypeIds = new Set(variant.pieceTypes.filter(({ royal }) => royal).map(({ id }) => id));
  const missingRoyals = variant.players.flatMap(({ id: playerId }) => {
    const royalPlacement = variant.setup.find(
      ({ ownerId, typeId }) => ownerId === playerId && royalTypeIds.has(typeId),
    );

    if (!royalPlacement) return [];

    const royalIsPresent = position.pieces.some(({ id }) => id === royalPlacement.id);
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

/**
 * The mover wins only by landing on one of its owner's own target cells with an
 * eligible piece type. Malformed target configuration is not repaired here.
 */
function reachTargetOutcome(
  variant: VariantDefinition,
  objective: ReachTargetObjective,
  move: AcceptedMove,
): GameOutcome | null {
  const ownerTargets = objective.targets.find(({ playerId }) => playerId === move.piece.ownerId);

  if (!ownerTargets) return null;
  if (ownerTargets.eligiblePieceTypeIds && !ownerTargets.eligiblePieceTypeIds.includes(move.piece.typeId)) return null;
  if (!ownerTargets.cells.some((cell) => cell.file === move.to.file && cell.rank === move.to.rank)) return null;

  const loser = variant.players.find(({ id }) => id !== move.piece.ownerId);

  if (!loser) return null;

  return Object.freeze({
    type: "win",
    reason: "reach-target",
    winnerPlayerId: move.piece.ownerId,
    loserPlayerId: loser.id,
    pieceId: move.piece.id,
    target: freezeCoordinate(move.to),
  });
}

/** Only a capture can win, and only when it removes the opponent's last piece. */
function eliminateAllOutcome(position: GameState, move: AcceptedMove): GameOutcome | null {
  const captured = move.captured;

  if (!captured) return null;
  if (position.pieces.some(({ ownerId }) => ownerId === captured.ownerId)) return null;

  return Object.freeze({
    type: "win",
    reason: "eliminate-all",
    winnerPlayerId: move.piece.ownerId,
    loserPlayerId: captured.ownerId,
    capturedPieceId: captured.id,
  });
}

function unsupportedObjective(objectiveType: string): EngineResult<never> {
  return {
    ok: false,
    error: Object.freeze({
      code: "INVALID_VARIANT",
      message: "The variant objective is not supported by this engine version.",
      details: Object.freeze({ objectiveType }),
    }),
  };
}
