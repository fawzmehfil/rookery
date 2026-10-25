import type {
  ApplyActionResult,
  EngineResult,
  GameOutcome,
  GameState,
  MoveAction,
  VariantDefinition,
} from "./types";

/**
 * The stable engine boundary shared by the editor, playtest UI, and session server.
 *
 * Movement legality is deliberately represented here but implemented separately
 * from state transitions so the authoritative server has one validation path.
 */
export interface RulesEngine {
  createInitialState(variant: VariantDefinition): EngineResult<GameState>;
  getLegalActions(variant: VariantDefinition, state: GameState): readonly MoveAction[];
  applyAction(variant: VariantDefinition, state: GameState, action: MoveAction): ApplyActionResult;
  evaluateOutcome(variant: VariantDefinition, state: GameState): GameOutcome | null;
}

export type CreateInitialState = RulesEngine["createInitialState"];
export type GetLegalActions = RulesEngine["getLegalActions"];
export type ApplyAction = RulesEngine["applyAction"];
export type EvaluateOutcome = RulesEngine["evaluateOutcome"];
