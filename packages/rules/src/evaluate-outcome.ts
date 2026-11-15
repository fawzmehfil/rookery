import { evaluateObjectiveOutcome } from "./internal/objective-outcome";
import type { GameOutcome, GameState, VariantDefinition } from "./types";

/**
 * Returns the recorded outcome, or the outcome derivable from the position alone.
 *
 * Capture-royal is fully positional. Reach-target and eliminate-all are decided
 * by `applyAction` from the accepted action, so for them this returns the outcome
 * stored on the state, or `null`; a position alone never infers their win.
 */
export function evaluateOutcome(variant: VariantDefinition, state: GameState): GameOutcome | null {
  if (state.outcome) return state.outcome;

  const result = evaluateObjectiveOutcome(variant, state, null);

  return result.ok ? result.value : null;
}
