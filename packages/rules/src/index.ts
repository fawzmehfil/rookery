export type {
  ApplyActionResult,
  ApplyActionValue,
  BoardDefinition,
  CaptureRoyalObjective,
  CaptureRoyalWinOutcome,
  Coordinate,
  CurrentVariantDefinition,
  DeepReadonly,
  EliminateAllObjective,
  EliminateAllWinOutcome,
  EngineError,
  EngineErrorCode,
  EngineErrorDetail,
  EngineEvent,
  EngineResult,
  GameEndedEvent,
  GameOutcome,
  GamePiece,
  GameState,
  LeapMovement,
  LegacyVariantDefinition,
  MoveAction,
  MovementFrame,
  MovementMode,
  MovementPattern,
  ObjectiveDefinition,
  ParseIssue,
  ParseResult,
  PieceCapturedEvent,
  PieceMovedEvent,
  PiecePlacement,
  PieceTypeDefinition,
  PlayerDefinition,
  ReachTargetObjective,
  ReachTargetPlayerTargets,
  ReachTargetWinOutcome,
  SlideMovement,
  StepMovement,
  TurnChangedEvent,
  VariantDefinition,
  Vector,
  WinOutcome,
} from "./types";
export type {
  ApplyAction,
  CreateInitialState,
  EvaluateOutcome,
  GetLegalActions,
  RulesEngine,
} from "./contracts";
export {
  boardDefinitionSchema,
  captureRoyalObjectiveSchema,
  coordinateSchema,
  currentVariantDefinitionSchema,
  eliminateAllObjectiveSchema,
  identifierSchema,
  leapMovementSchema,
  legacyVariantDefinitionSchema,
  movementFrameSchema,
  movementModeSchema,
  movementPatternSchema,
  objectiveDefinitionSchema,
  piecePlacementSchema,
  pieceTypeDefinitionSchema,
  playerDefinitionSchema,
  reachTargetObjectiveSchema,
  reachTargetPlayerTargetsSchema,
  slideMovementSchema,
  stepMovementSchema,
  variantDefinitionSchema,
  vectorSchema,
} from "./schema";
export { coordinateToSquare, squareToCoordinate } from "./coordinates";
export { applyAction } from "./apply-action";
export { createInitialState } from "./create-initial-state";
export { evaluateOutcome } from "./evaluate-outcome";
export { getLegalActions } from "./get-legal-actions";
export { parseVariantDefinition } from "./parse";
export { createPieceTypeFromTemplate, getPieceTemplate, pieceTemplateCatalog } from "./piece-templates";
export type {
  PieceTemplate,
  PieceTemplateCategory,
  PieceTemplateId,
  PieceTemplateTag,
} from "./piece-templates";
export { validateVariantDefinition } from "./validate-variant";
export type { ValidationCode, ValidationIssue } from "./validate-variant";
