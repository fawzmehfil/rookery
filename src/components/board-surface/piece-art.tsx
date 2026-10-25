import type { ReactNode } from "react";
import type { BoardSide } from "./types";
import styles from "./board-surface.module.css";

/*
 * Original piece artwork on a 45×45 grid: flat fills with a heavy outline,
 * every piece standing on the same plinth so the set reads as one family.
 */
const plinth = (
  <>
    <rect x="12" y="32" width="21" height="3.5" rx="1.2" />
    <rect x="9.5" y="35.5" width="26" height="5" rx="2" />
  </>
);

const SHAPES: Record<string, ReactNode> = {
  pawn: (
    <>
      <path d="M19 21.5c0 4.8-2.6 7.6-5.2 10.5h17.4c-2.6-2.9-5.2-5.7-5.2-10.5z" />
      <rect x="16" y="18.5" width="13" height="3.4" rx="1.4" />
      <circle cx="22.5" cy="12.6" r="5.6" />
      {plinth}
    </>
  ),
  rook: (
    <>
      <path d="M15 17.5h15l-1.6 3v9.4l2.6 2.1H14l2.6-2.1v-9.4z" />
      <path d="M11.5 8h4.6v3.6h3.6V8h5.6v3.6h3.6V8h4.6v7.2l-2.4 2.3H13.9l-2.4-2.3z" />
      {plinth}
    </>
  ),
  bishop: (
    <>
      <path d="M19 28.5c0 1.6-1.5 2.6-3.2 3.5h13.4c-1.7-.9-3.2-1.9-3.2-3.5z" />
      <rect x="15.2" y="25.6" width="14.6" height="3.4" rx="1.4" />
      <path d="M22.5 9.2c-6.4 3.8-9 9.8-6.6 16.4h13.2c2.4-6.6-.2-12.6-6.6-16.4z" />
      <path d="M25.6 13.4l-4.4 5.4" data-part="line" />
      <circle cx="22.5" cy="6.6" r="2.4" />
      {plinth}
    </>
  ),
  knight: (
    <>
      <path d="M26.4 10.6l5.4-2-1.6 4.6zM29.8 14.8l5-.6-2.4 4.2zM31.4 20l4.4.6-3.4 3.4z" />
      <path d="M14.2 32c-.4-5.6 2.6-8.6 6.6-11.6-2.4 1.3-5 1.6-7.2.8l-2.4 1.8c-1.6 1-3.2-.2-2.6-1.9 1.4-4.4 4.4-8 7.4-10.4l.2-4.6 3.2 2.8c7.6-.6 13.4 5.4 13.4 13.6 0 3.6-.8 6.6-1.8 9.5z" />
      <ellipse cx="18.8" cy="14.6" rx="1.3" ry="1" data-part="eye" />
      {plinth}
    </>
  ),
  queen: (
    <>
      <path d="M12.6 29.4L10 14.2l6.6 7.6 5.9-12.6 5.9 12.6 6.6-7.6-2.6 15.2z" />
      <circle cx="10" cy="12.4" r="2.2" />
      <circle cx="22.5" cy="7.4" r="2.2" />
      <circle cx="35" cy="12.4" r="2.2" />
      <rect x="12" y="28.6" width="21" height="3.6" rx="1.4" />
      {plinth}
    </>
  ),
  king: (
    <>
      <path d="M22.5 13.2c-7.6 0-11.8 4.8-10.6 10.8l1.6 5.4h18l1.6-5.4c1.2-6-3-10.8-10.6-10.8z" />
      <path d="M21.2 3.6h2.6v3h3v2.6h-3v4h-2.6v-4h-3V6.6h3z" />
      <path d="M17.2 21.4c3.4-1.4 7.2-1.4 10.6 0" data-part="line" />
      <rect x="12" y="28.6" width="21" height="3.6" rx="1.4" />
      {plinth}
    </>
  ),
};

export function PieceArt({ kind, side }: { kind: string; side: BoardSide }) {
  const shape = SHAPES[kind];

  return (
    <svg viewBox="0 0 45 45" className={`${styles.art} ${side === "white" ? styles.artWhite : styles.artBlack}`} aria-hidden="true">
      {shape ?? (
        // Kinds without artwork, such as editor-made pieces, get a lettered token.
        <>
          <circle cx="22.5" cy="22.5" r="15" />
          <text x="22.5" y="23" data-part="letter">
            {kind.charAt(0).toUpperCase()}
          </text>
        </>
      )}
    </svg>
  );
}
