import type { Coordinate } from "./types";

const FILE_LABELS = "abcdefghijklmnopqrstuvwxyz";
const SQUARE_PATTERN = /^([a-z])([1-9]|1[0-9]|2[0-6])$/i;

export function coordinateToSquare(coordinate: Coordinate): string {
  const file = FILE_LABELS[coordinate.file];

  if (file === undefined || !Number.isInteger(coordinate.rank) || coordinate.rank < 0 || coordinate.rank >= 26) {
    throw new RangeError("Coordinates must use zero-based file and rank values from 0 through 25.");
  }

  return `${file}${coordinate.rank + 1}`;
}

export function squareToCoordinate(square: string): Coordinate | null {
  const match = SQUARE_PATTERN.exec(square.trim());

  if (!match) return null;

  const file = match[1];
  const rank = match[2];

  if (file === undefined || rank === undefined) return null;

  return {
    file: FILE_LABELS.indexOf(file.toLowerCase()),
    rank: Number(rank) - 1,
  };
}
