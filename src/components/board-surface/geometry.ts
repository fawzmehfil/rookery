import type { BoardSide, BoardSquare } from "./types";

/*
 * Pure layout helpers for drawing a board. They only translate between
 * square names and screen positions; nothing here knows about game rules.
 */

const FILE_LETTERS = "abcdefghijklmnopqrstuvwxyz";

export type Cell = { file: number; rank: number };

export function squareName(file: number, rank: number): BoardSquare {
  return `${FILE_LETTERS[file]}${rank + 1}`;
}

export function parseSquare(square: BoardSquare): Cell {
  return { file: FILE_LETTERS.indexOf(square[0]), rank: Number(square.slice(1)) - 1 };
}

export function fileLabel(file: number): string {
  return FILE_LETTERS[file];
}

export function isOnBoard(square: BoardSquare, files: number, ranks: number): boolean {
  const { file, rank } = parseSquare(square);
  return file >= 0 && file < files && rank >= 0 && rank < ranks && Number.isInteger(rank);
}

/** Row and column on screen, counted from the top-left, for the given orientation. */
export function screenPosition(square: BoardSquare, files: number, ranks: number, orientation: BoardSide) {
  const { file, rank } = parseSquare(square);
  return orientation === "white"
    ? { row: ranks - 1 - rank, column: file }
    : { row: rank, column: files - 1 - file };
}

/** Squares in reading order (left to right, top to bottom) as they appear on screen. */
export function squaresOnScreen(files: number, ranks: number, orientation: BoardSide): BoardSquare[] {
  const squares: BoardSquare[] = [];
  for (let row = 0; row < ranks; row++) {
    for (let column = 0; column < files; column++) {
      const file = orientation === "white" ? column : files - 1 - column;
      const rank = orientation === "white" ? ranks - 1 - row : row;
      squares.push(squareName(file, rank));
    }
  }
  return squares;
}

/** a1 is dark on a standard board, so light squares have an odd file + rank. */
export function isLightSquare(square: BoardSquare): boolean {
  const { file, rank } = parseSquare(square);
  return (file + rank) % 2 === 1;
}

/** Moves a square by a screen direction, clamped to the board edges. */
export function stepOnScreen(
  square: BoardSquare,
  direction: "up" | "down" | "left" | "right",
  files: number,
  ranks: number,
  orientation: BoardSide,
): BoardSquare {
  const { file, rank } = parseSquare(square);
  const flip = orientation === "white" ? 1 : -1;
  const [df, dr] = {
    up: [0, flip],
    down: [0, -flip],
    left: [-flip, 0],
    right: [flip, 0],
  }[direction];
  return squareName(Math.min(files - 1, Math.max(0, file + df)), Math.min(ranks - 1, Math.max(0, rank + dr)));
}
