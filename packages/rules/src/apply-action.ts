import { getLegalActions } from "./get-legal-actions";
import {
  actionFailure,
  applyConfirmedAction,
  validateConfirmedActionPreconditions,
} from "./internal/apply-confirmed-action";
import type { ApplyActionResult, GameState, MoveAction, VariantDefinition } from "./types";

/**
 * Applies a proposed action through the public, authoritative engine path.
 * Generic state/action errors are reported first; otherwise the action must
 * exactly match the current legal-action set before the transition kernel runs.
 */
export function applyAction(
  variant: VariantDefinition,
  state: GameState,
  action: MoveAction,
): ApplyActionResult {
  const preconditionError = validateConfirmedActionPreconditions(variant, state, action);

  if (preconditionError) return { ok: false, error: preconditionError };

  const legal = getLegalActions(variant, state).some(
    (candidate) =>
      candidate.type === action.type &&
      candidate.pieceId === action.pieceId &&
      candidate.to.file === action.to.file &&
      candidate.to.rank === action.to.rank,
  );

  if (!legal) {
    return actionFailure("ACTION_NOT_LEGAL", "The proposed action is not legal in the current position.", {
      pieceId: action.pieceId,
      destinationFile: action.to.file,
      destinationRank: action.to.rank,
    });
  }

  return applyConfirmedAction(variant, state, action);
}
