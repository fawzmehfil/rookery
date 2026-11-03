"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  fileLabel,
  isLightSquare,
  isOnBoard,
  parseSquare,
  screenPosition,
  squaresOnScreen,
  stepOnScreen,
} from "./geometry";
import { PieceArt } from "./piece-art";
import type { BoardPiece, BoardSquare, BoardSurfaceProps } from "./types";
import styles from "./board-surface.module.css";

const ARROWS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
} as const;

/**
 * A controlled board. It draws whatever position and highlights it's given
 * and reports which square was activated; deciding what that means (select,
 * move, place a piece) is up to the editor or playtest wrapper around it.
 */
export function BoardSurface({
  files,
  ranks,
  pieces,
  label,
  orientation = "white",
  selectedSquare = null,
  legalDestinations = [],
  captureDestinations = [],
  lastMove = null,
  checkSquares = [],
  disabledSquares = [],
  disabled = false,
  coordinates = true,
  onSquareActivate,
  renderPiece,
}: BoardSurfaceProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Only keyboard focus lives here; everything about the game comes from props.
  const [focused, setFocused] = useState<BoardSquare | null>(null);

  const squares = squaresOnScreen(files, ranks, orientation);
  const pieceAt = new Map(pieces.map((piece) => [piece.square, piece]));
  const legal = new Set(legalDestinations);
  const captures = new Set(captureDestinations);
  const checks = new Set(checkSquares);
  const holes = new Set(disabledSquares);

  // The roving tab stop: the last focused square, else the selection, else the bottom-left corner.
  const fallback = selectedSquare && isOnBoard(selectedSquare, files, ranks) ? selectedSquare : squares[(ranks - 1) * files];
  const tabStop = focused && isOnBoard(focused, files, ranks) ? focused : fallback;

  function activate(square: BoardSquare, input: "pointer" | "keyboard") {
    if (disabled || holes.has(square)) return;
    onSquareActivate?.({ square, piece: pieceAt.get(square) ?? null, input });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, square: BoardSquare) {
    if (event.key in ARROWS) {
      const next = stepOnScreen(square, ARROWS[event.key as keyof typeof ARROWS], files, ranks, orientation);
      setFocused(next);
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-square="${next}"]`)?.focus();
      event.preventDefault();
    } else if (event.key === "Enter" || event.key === " ") {
      // Handled here rather than by the button's click so the callback knows the input came from the keyboard.
      event.preventDefault();
      activate(square, "keyboard");
    }
  }

  return (
    <div
      className={styles.surface}
      style={{ "--files": files, "--ranks": ranks } as CSSProperties}
      data-disabled={disabled || undefined}
    >
      <div ref={gridRef} className={styles.grid} role="group" aria-label={label}>
        {squares.map((square) => {
          const piece = pieceAt.get(square);
          const { row, column } = screenPosition(square, files, ranks, orientation);
          const state = {
            selected: square === selectedSquare,
            legal: legal.has(square),
            capture: captures.has(square),
            lastMove: square === lastMove?.from || square === lastMove?.to,
            check: checks.has(square),
            hole: holes.has(square),
          };

          return (
            <button
              key={square}
              type="button"
              data-square={square}
              className={[
                styles.square,
                isLightSquare(square) ? styles.light : styles.dark,
                state.lastMove && styles.lastMove,
                state.selected && styles.selected,
                state.check && styles.check,
                state.legal && styles.legal,
                state.capture && styles.capture,
                state.hole && styles.hole,
              ]
                .filter(Boolean)
                .join(" ")}
              tabIndex={square === tabStop ? 0 : -1}
              aria-label={describeSquare(square, piece, state)}
              aria-pressed={state.selected}
              aria-disabled={disabled || state.hole || undefined}
              onClick={() => activate(square, "pointer")}
              onKeyDown={(event) => handleKeyDown(event, square)}
              onFocus={() => setFocused(square)}
            >
              {coordinates && column === 0 && <span className={styles.rankLabel}>{parseSquare(square).rank + 1}</span>}
              {coordinates && row === ranks - 1 && <span className={styles.fileLabel}>{fileLabel(parseSquare(square).file)}</span>}
            </button>
          );
        })}
      </div>

      {/* Pieces sit in their own layer, keyed by id, so a moved piece glides to its new square. */}
      <div className={styles.pieces} aria-hidden="true">
        {pieces
          .filter((piece) => isOnBoard(piece.square, files, ranks))
          .map((piece) => {
            const { row, column } = screenPosition(piece.square, files, ranks, orientation);
            return (
              <div key={piece.id} className={styles.piece} style={{ translate: `${column * 100}% ${row * 100}%` }}>
                {renderPiece?.(piece) ?? <PieceArt kind={piece.kind} side={piece.side} />}
              </div>
            );
          })}
      </div>
    </div>
  );
}

type SquareState = Record<"selected" | "legal" | "capture" | "lastMove" | "check" | "hole", boolean>;

/** e.g. "e4, white knight, selected" or "d5, black pawn, capture". */
function describeSquare(square: BoardSquare, piece: BoardPiece | undefined, state: SquareState): string {
  const parts = [square];
  if (state.hole) parts.push("not part of the board");
  if (piece) parts.push(piece.label ?? `${piece.side} ${piece.kind}`);
  if (state.selected) parts.push("selected");
  if (state.capture) parts.push("capture");
  else if (state.legal) parts.push("legal move");
  if (state.check) parts.push("in check");
  if (state.lastMove) parts.push("last move");
  return parts.join(", ");
}
