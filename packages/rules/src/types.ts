import type { z } from "zod";
import type {
  boardDefinitionSchema,
  captureRoyalObjectiveSchema,
  coordinateSchema,
  leapMovementSchema,
  movementFrameSchema,
  movementModeSchema,
  movementPatternSchema,
  piecePlacementSchema,
  pieceTypeDefinitionSchema,
  playerDefinitionSchema,
  slideMovementSchema,
  stepMovementSchema,
  variantDefinitionSchema,
  vectorSchema,
} from "./schema";

export type DeepReadonly<Value> = Value extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

export type Coordinate = DeepReadonly<z.output<typeof coordinateSchema>>;
export type Vector = DeepReadonly<z.output<typeof vectorSchema>>;
export type MovementFrame = z.output<typeof movementFrameSchema>;
export type MovementMode = z.output<typeof movementModeSchema>;
export type StepMovement = DeepReadonly<z.output<typeof stepMovementSchema>>;
export type LeapMovement = DeepReadonly<z.output<typeof leapMovementSchema>>;
export type SlideMovement = DeepReadonly<z.output<typeof slideMovementSchema>>;
export type MovementPattern = DeepReadonly<z.output<typeof movementPatternSchema>>;
export type BoardDefinition = DeepReadonly<z.output<typeof boardDefinitionSchema>>;
export type PlayerDefinition = DeepReadonly<z.output<typeof playerDefinitionSchema>>;
export type PieceTypeDefinition = DeepReadonly<z.output<typeof pieceTypeDefinitionSchema>>;
export type PiecePlacement = DeepReadonly<z.output<typeof piecePlacementSchema>>;
export type CaptureRoyalObjective = DeepReadonly<z.output<typeof captureRoyalObjectiveSchema>>;
export type VariantDefinition = DeepReadonly<z.output<typeof variantDefinitionSchema>>;

export type ParseIssue = Readonly<{
  code: string;
  message: string;
  path: readonly (string | number)[];
}>;

export type ParseResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; issues: readonly ParseIssue[] }>;

export type GamePiece = Readonly<{
  id: string;
  typeId: string;
  ownerId: string;
  at: Coordinate;
}>;

export type WinOutcome = Readonly<{
  type: "win";
  reason: "capture-royal";
  winnerPlayerId: string;
  loserPlayerId: string;
  capturedPieceId: string;
}>;

export type GameOutcome = WinOutcome;

export type GameState = Readonly<{
  variantId: string;
  ply: number;
  activePlayerId: string | null;
  pieces: readonly GamePiece[];
  outcome: GameOutcome | null;
}>;

export type MoveAction = Readonly<{
  type: "move";
  pieceId: string;
  to: Coordinate;
}>;

export type PieceMovedEvent = Readonly<{
  type: "piece-moved";
  ply: number;
  pieceId: string;
  ownerId: string;
  from: Coordinate;
  to: Coordinate;
}>;

export type PieceCapturedEvent = Readonly<{
  type: "piece-captured";
  ply: number;
  piece: GamePiece;
  byPieceId: string;
  at: Coordinate;
}>;

export type TurnChangedEvent = Readonly<{
  type: "turn-changed";
  ply: number;
  fromPlayerId: string;
  toPlayerId: string;
}>;

export type GameEndedEvent = Readonly<{
  type: "game-ended";
  ply: number;
  outcome: GameOutcome;
}>;

export type EngineEvent = PieceMovedEvent | PieceCapturedEvent | TurnChangedEvent | GameEndedEvent;

export type EngineErrorCode =
  | "INVALID_VARIANT"
  | "GAME_ALREADY_ENDED"
  | "PIECE_NOT_FOUND"
  | "NOT_ACTIVE_PLAYER"
  | "SAME_SQUARE"
  | "DESTINATION_OUT_OF_BOUNDS"
  | "DESTINATION_DISABLED"
  | "DESTINATION_OCCUPIED_BY_ALLY"
  | "LEGAL_ACTIONS_UNAVAILABLE";

export type EngineErrorDetail = string | number | boolean | null;

export type EngineError = Readonly<{
  code: EngineErrorCode;
  message: string;
  details?: Readonly<Record<string, EngineErrorDetail>>;
}>;

export type EngineResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; error: EngineError }>;

export type ApplyActionValue = Readonly<{
  state: GameState;
  events: readonly EngineEvent[];
}>;

export type ApplyActionResult = EngineResult<ApplyActionValue>;
