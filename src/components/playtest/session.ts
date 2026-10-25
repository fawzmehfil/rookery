import type { BoardMove, BoardPiece, BoardSide, BoardSquare } from "@/components/board-surface";

/*
 * What the playtest screen needs from a game session. The screen only ever
 * renders snapshots returned by these calls, so the session (and the rules
 * engine behind it) stays the single source of truth.
 *
 * This mirrors the session controller from Task 11. Once that lands, its
 * public API should satisfy this shape directly or through a thin adapter.
 */

export type PlaytestAction = {
  type: "move";
  from: BoardSquare;
  to: BoardSquare;
  /** Piece kind to promote to, when the move requires a choice. */
  promotion?: string;
};

export type LegalAction = PlaytestAction & {
  captures: boolean;
};

export type PlaytestEvent =
  | { type: "capture"; piece: BoardPiece; square: BoardSquare }
  | { type: "promotion"; piece: BoardPiece; square: BoardSquare }
  | { type: "check"; side: BoardSide };

export type PlaytestOutcome = {
  winner: BoardSide | null;
  reason: string;
};

export type PlaytestSnapshot = {
  variantName: string;
  files: number;
  ranks: number;
  pieces: readonly BoardPiece[];
  disabledSquares?: readonly BoardSquare[];
  activeSide: BoardSide;
  turnNumber: number;
  lastMove: BoardMove | null;
  checkSquares: readonly BoardSquare[];
  /** Events produced by the most recent accepted action. */
  events: readonly PlaytestEvent[];
  outcome: PlaytestOutcome | null;
};

export type SessionError = {
  code: string;
  message: string;
};

export type SubmitResult = { ok: true; snapshot: PlaytestSnapshot } | { ok: false; error: SessionError };

export interface PlaytestSession {
  snapshot(): PlaytestSnapshot;
  legalActions(from: BoardSquare): readonly LegalAction[];
  submit(action: PlaytestAction): SubmitResult;
  /** Returns the session to the variant's initial state. */
  reset(): PlaytestSnapshot;
}
