import type { ReactNode } from "react";

export type BoardSide = "white" | "black";

/** Algebraic square name: a file letter followed by a 1-based rank, e.g. "e4". */
export type BoardSquare = string;

export type BoardPiece = {
  /** Stable identity across moves. Used as the React key so pieces animate instead of remounting. */
  id: string;
  square: BoardSquare;
  /** Built-in art exists for king, queen, rook, bishop, knight and pawn; other kinds fall back to a lettered token. */
  kind: string;
  side: BoardSide;
  /** Overrides the accessible name, e.g. "white archbishop". */
  label?: string;
};

export type BoardMove = {
  from: BoardSquare;
  to: BoardSquare;
};

export type SquareActivation = {
  square: BoardSquare;
  piece: BoardPiece | null;
  input: "pointer" | "keyboard";
};

export type BoardSurfaceProps = {
  /** Number of columns, 1–26. */
  files: number;
  /** Number of rows. */
  ranks: number;
  pieces: readonly BoardPiece[];
  /** Accessible name for the whole board. */
  label: string;
  /** Which side is drawn at the bottom. Defaults to white. */
  orientation?: BoardSide;
  selectedSquare?: BoardSquare | null;
  /** Empty squares the selected piece may move to. */
  legalDestinations?: readonly BoardSquare[];
  /** Squares where moving would capture. Drawn differently from legal destinations. */
  captureDestinations?: readonly BoardSquare[];
  lastMove?: BoardMove | null;
  /** Squares holding a king in check. */
  checkSquares?: readonly BoardSquare[];
  /** Cells that aren't part of the board. They render as gaps and can't be activated. */
  disabledSquares?: readonly BoardSquare[];
  /** Blocks every activation, e.g. after the game ends. Squares stay focusable so the position can still be read. */
  disabled?: boolean;
  /** Show rank and file labels along the edges. Defaults to true. */
  coordinates?: boolean;
  onSquareActivate?: (activation: SquareActivation) => void;
  /** Custom rendering for pieces, e.g. editor-defined piece art. Return undefined to use the default. */
  renderPiece?: (piece: BoardPiece) => ReactNode | undefined;
};
