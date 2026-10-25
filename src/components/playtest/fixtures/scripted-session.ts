import type { BoardPiece, BoardSide, BoardSquare } from "@/components/board-surface";
import type { LegalAction, PlaytestAction, PlaytestEvent, PlaytestSession, PlaytestSnapshot, SubmitResult } from "../session";

/*
 * A test double for PlaytestSession. It knows no chess: it replays a fixed
 * list of moves and treats the next scripted move as the only legal action.
 * Used by tests and the dev preview until the real session controller and
 * rules engine are available. Never use it on the product path.
 */

export type ScriptedPly = {
  from: BoardSquare;
  to: BoardSquare;
  check?: BoardSquare;
  outcome?: PlaytestSnapshot["outcome"];
};

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

export function standardPieces(): BoardPiece[] {
  const pieces: BoardPiece[] = [];
  const files = "abcdefgh";
  for (const [side, back, pawns] of [
    ["white", 1, 2],
    ["black", 8, 7],
  ] as const) {
    BACK_RANK.forEach((kind, file) => pieces.push({ id: `${side}-${kind}-${files[file]}`, square: `${files[file]}${back}`, kind, side }));
    for (const file of files) pieces.push({ id: `${side}-pawn-${file}`, square: `${file}${pawns}`, kind: "pawn", side });
  }
  return pieces;
}

/** e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#: a short game with a capture, a check and a win. */
export const SCHOLARS_MATE: ScriptedPly[] = [
  { from: "e2", to: "e4" },
  { from: "e7", to: "e5" },
  { from: "d1", to: "h5" },
  { from: "b8", to: "c6" },
  { from: "f1", to: "c4" },
  { from: "g8", to: "f6" },
  { from: "h5", to: "f7", check: "e8", outcome: { winner: "white", reason: "checkmate" } },
];

export function createScriptedSession(
  script: readonly ScriptedPly[] = SCHOLARS_MATE,
  variantName = "Standard Chess",
): PlaytestSession {
  const initial: PlaytestSnapshot = {
    variantName,
    files: 8,
    ranks: 8,
    pieces: standardPieces(),
    activeSide: "white",
    turnNumber: 1,
    lastMove: null,
    checkSquares: [],
    events: [],
    outcome: null,
  };

  let ply = 0;
  let current = initial;

  const next = (): ScriptedPly | undefined => script[ply];
  const pieceOn = (square: BoardSquare) => current.pieces.find((piece) => piece.square === square);

  return {
    snapshot: () => current,

    legalActions(from): LegalAction[] {
      const scripted = next();
      if (current.outcome || !scripted || scripted.from !== from) return [];
      return [{ type: "move", from, to: scripted.to, captures: Boolean(pieceOn(scripted.to)) }];
    },

    submit(action: PlaytestAction): SubmitResult {
      if (current.outcome) return { ok: false, error: { code: "game-over", message: "The game has ended." } };
      const mover = pieceOn(action.from);
      if (mover && mover.side !== current.activeSide) {
        return { ok: false, error: { code: "not-your-turn", message: `It is ${current.activeSide}'s turn.` } };
      }
      const scripted = next();
      if (!mover || !scripted || scripted.from !== action.from || scripted.to !== action.to) {
        return { ok: false, error: { code: "illegal-move", message: `${action.from}-${action.to} is not legal.` } };
      }

      const captured = pieceOn(action.to);
      const events: PlaytestEvent[] = [];
      if (captured) events.push({ type: "capture", piece: captured, square: action.to });
      const nextSide: BoardSide = current.activeSide === "white" ? "black" : "white";
      if (scripted.check) events.push({ type: "check", side: nextSide });

      ply += 1;
      current = {
        ...current,
        pieces: current.pieces
          .filter((piece) => piece !== captured)
          .map((piece) => (piece === mover ? { ...piece, square: action.to } : piece)),
        activeSide: nextSide,
        turnNumber: nextSide === "white" ? current.turnNumber + 1 : current.turnNumber,
        lastMove: { from: action.from, to: action.to },
        checkSquares: scripted.check ? [scripted.check] : [],
        events,
        outcome: scripted.outcome ?? null,
      };
      return { ok: true, snapshot: current };
    },

    reset() {
      ply = 0;
      current = initial;
      return current;
    },
  };
}
