"use client";

import { useState } from "react";
import { BoardSurface, type BoardPiece, type SquareActivation } from "@/components/board-surface";

/*
 * Fixed examples of every board state, for review and screenshots.
 * The highlights here are hard-coded props, not computed moves.
 */

const KINDS: Record<string, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };

const STANDARD: BoardPiece[] = [
  ..."rnbqkbnr".split("").map((letter, file) => piece(letter, file, 7)),
  ..."pppp.ppp".split("").map((letter, file) => piece(letter, file, 6)),
  piece("p", 4, 4),
  piece("P", 4, 3),
  piece("N", 5, 2),
  ..."PPPP.PPP".split("").map((letter, file) => piece(letter, file, 1)),
  ..."RNBQKB.R".split("").map((letter, file) => piece(letter, file, 0)),
].filter((entry): entry is BoardPiece => entry !== null);

const SMALL: BoardPiece[] = [
  { id: "w-king", square: "c1", kind: "king", side: "white" },
  { id: "w-archer", square: "b2", kind: "archer", side: "white", label: "white archer" },
  { id: "b-king", square: "d6", kind: "king", side: "black" },
  { id: "b-rook", square: "a6", kind: "rook", side: "black" },
];

function piece(letter: string, file: number, rank: number): BoardPiece | null {
  if (letter === ".") return null;
  const side = letter === letter.toUpperCase() ? "white" : "black";
  const square = `${"abcdefgh"[file]}${rank + 1}`;
  return { id: `${side}-${letter}-${square}`, square, kind: KINDS[letter.toLowerCase()], side };
}

export function BoardSurfacePreview() {
  const [log, setLog] = useState<SquareActivation[]>([]);
  const record = (activation: SquareActivation) => setLog((entries) => [activation, ...entries].slice(0, 6));

  return (
    <div style={{ display: "grid", gap: "2rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
      <figure style={{ margin: 0 }}>
        <BoardSurface
          files={8}
          ranks={8}
          pieces={STANDARD}
          label="Standard board example"
          selectedSquare="f3"
          legalDestinations={["g1", "d4", "g5", "h4"]}
          captureDestinations={["e5"]}
          lastMove={{ from: "e7", to: "e5" }}
          onSquareActivate={record}
        />
        <figcaption>8 × 8 · selection, legal moves, a capture and the last move</figcaption>
      </figure>

      <figure style={{ margin: 0 }}>
        <BoardSurface
          files={6}
          ranks={6}
          pieces={SMALL}
          label="Small board example"
          orientation="black"
          checkSquares={["c1"]}
          disabledSquares={["c3", "d3", "c4", "d4"]}
          onSquareActivate={record}
        />
        <figcaption>6 × 6 from black&apos;s side · check, removed cells and a custom piece</figcaption>
      </figure>

      <section aria-live="polite">
        <h2 style={{ fontSize: "1rem" }}>onSquareActivate</h2>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
          {log.length ? log.map((entry) => JSON.stringify({ ...entry, piece: entry.piece?.id ?? null })).join("\n") : "Click or press Enter on a square."}
        </pre>
      </section>
    </div>
  );
}
