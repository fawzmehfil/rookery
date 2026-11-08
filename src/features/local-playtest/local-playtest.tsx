"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  coordinateToSquare,
  getLegalActions,
  squareToCoordinate,
  type EngineError,
  type EngineEvent,
  type MoveAction,
} from "@rookery/rules";
import { BoardSurface, type BoardMove, type SquareActivation } from "@/components/board-surface";
import { variantBoardPieces } from "@/features/variant-board/board-adapter";
import { SessionPieceArt } from "@/features/piece-library/appearance";
import rookeryLogo from "../../../assets/rookery.png";
import {
  resetLocalSession,
  submitLocalAction,
  type LocalSession,
} from "./local-session";
import styles from "./local-playtest.module.css";

export type LocalPlaytestProps = {
  initialSession: LocalSession;
  onReturnToEditor: () => void;
};

export function LocalPlaytest({ initialSession, onReturnToEditor }: LocalPlaytestProps) {
  const [session, setSession] = useState(initialSession);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [error, setError] = useState<EngineError | null>(null);
  const [message, setMessage] = useState("Select a piece belonging to the active player.");
  const { variant, state } = session;
  const selectedPiece = state.pieces.find(({ id }) => id === selectedPieceId) ?? null;
  const legalActions = useMemo(() => getLegalActions(variant, state), [variant, state]);
  const selectedActions = selectedPieceId
    ? legalActions.filter(({ pieceId }) => pieceId === selectedPieceId)
    : [];
  const occupied = new Map(state.pieces.map((piece) => [coordinateToSquare(piece.at), piece]));
  const legalDestinations: string[] = [];
  const captureDestinations: string[] = [];

  for (const action of selectedActions) {
    const square = coordinateToSquare(action.to);
    if (occupied.has(square)) captureDestinations.push(square);
    else legalDestinations.push(square);
  }

  const activePlayer = variant.players.find(({ id }) => id === state.activePlayerId);
  const winner = variant.players.find(({ id }) => id === state.outcome?.winnerPlayerId);
  const turn = Math.floor(state.ply / variant.turnOrder.length) + 1;
  const captured = variant.setup.filter(
    ({ id }) => !state.pieces.some((piece) => piece.id === id),
  );
  const lastMove = lastBoardMove(session);

  function submit(action: MoveAction) {
    const result = submitLocalAction(session, action);

    if (!result.ok) {
      setError(result.error);
      setMessage("The engine rejected that action. The position was not changed.");
      return;
    }

    setSession(result.value);
    setSelectedPieceId(null);
    setError(null);
    setMessage(
      result.value.state.outcome
        ? "The royal capture ended the game."
        : "Move accepted. Select a piece for the next player.",
    );
  }

  function activate({ square, piece }: SquareActivation) {
    const coordinate = squareToCoordinate(square);
    if (!coordinate || state.outcome) return;

    const clickedPiece = piece
      ? state.pieces.find(({ id }) => id === piece.id) ?? null
      : null;

    if (clickedPiece?.id === selectedPieceId) {
      setSelectedPieceId(null);
      setError(null);
      setMessage("Selection cleared.");
      return;
    }

    if (clickedPiece?.ownerId === state.activePlayerId) {
      setSelectedPieceId(clickedPiece.id);
      setError(null);
      setMessage(`${piece?.label ?? clickedPiece.id} selected. Choose a highlighted destination.`);
      return;
    }

    if (selectedPieceId) {
      submit({ type: "move", pieceId: selectedPieceId, to: coordinate });
      return;
    }

    if (clickedPiece) {
      submit({ type: "move", pieceId: clickedPiece.id, to: coordinate });
      return;
    }

    setError(null);
    setMessage("Select a piece belonging to the active player first.");
  }

  function reset() {
    setSession(resetLocalSession(session));
    setSelectedPieceId(null);
    setError(null);
    setMessage("Playtest reset to the exact validated starting position.");
  }

  return (
    <main className={styles.playtest} onKeyDown={(event) => {
      if (event.key === "Escape") {
        setSelectedPieceId(null);
        setError(null);
        setMessage("Selection cleared.");
      }
    }}>
      <a href="#playtest-board" className="skip-link">Skip to playtest board</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Rookery home">
          <Image src={rookeryLogo} alt="" width={42} height={42} priority />
        </Link>
        <span className={styles.badge}>Local playtest</span>
        <button type="button" className={styles.secondary} onClick={onReturnToEditor}>
          Return to editor
        </button>
        <button type="button" className={styles.primary} onClick={reset}>Reset position</button>
      </header>

      <section className={styles.intro} aria-labelledby="playtest-title">
        <div>
          <p className={styles.eyebrow}>Validated engine session</p>
          <h1 id="playtest-title">{variant.name}</h1>
          <p>Every highlight and move comes from the shared rules engine.</p>
        </div>
        <dl className={styles.facts}>
          <div><dt>Turn</dt><dd>{turn}</dd></div>
          <div><dt>Ply</dt><dd>{state.ply}</dd></div>
          <div><dt>To move</dt><dd>{activePlayer?.name ?? "Game over"}</dd></div>
          <div><dt>Captured</dt><dd>{captured.length}</dd></div>
        </dl>
      </section>

      <div className={styles.workspace}>
        <section className={styles.boardPanel} id="playtest-board" aria-labelledby="board-heading">
          <div className={styles.boardTop}>
            <h2 id="board-heading">Playtest board</h2>
            <span>{variant.board.files} × {variant.board.ranks}</span>
          </div>
          <div className={styles.boardFrame}>
            <BoardSurface
              files={variant.board.files}
              ranks={variant.board.ranks}
              pieces={variantBoardPieces(variant, state.pieces)}
              renderPiece={piece => <SessionPieceArt piece={piece} />}
              label={`${variant.name} playtest board`}
              selectedSquare={selectedPiece ? coordinateToSquare(selectedPiece.at) : null}
              legalDestinations={legalDestinations}
              captureDestinations={captureDestinations}
              lastMove={lastMove}
              disabledSquares={variant.board.disabledCells.map(coordinateToSquare)}
              disabled={Boolean(state.outcome)}
              onSquareActivate={activate}
            />
          </div>
          <p className={styles.keyboardHelp}>
            Keyboard: Tab to the board, arrows to move focus, Enter or Space to select and move. Escape clears selection.
          </p>
          <p className={styles.message} role="status">{message}</p>
        </section>

        <aside className={styles.panel} aria-label="Playtest details">
          <section className={styles.gameStatus} data-finished={Boolean(state.outcome) || undefined}>
            <p className={styles.eyebrow}>Current status</p>
            <h2>
              {state.outcome
                ? `${winner?.name ?? state.outcome.winnerPlayerId} wins`
                : `${activePlayer?.name ?? "Unknown player"} to move`}
            </h2>
            <p>
              {state.outcome
                ? "Victory by capturing the opposing royal. Board input is now locked."
                : `${selectedActions.length} legal target${selectedActions.length === 1 ? "" : "s"}${selectedPiece ? " for the selected piece" : " available after selecting a piece"}.`}
            </p>
          </section>

          {error && <EngineErrorPanel error={error} />}

          <section aria-labelledby="captured-heading">
            <h2 id="captured-heading" className={styles.sectionHeading}>Captures</h2>
            {captured.length === 0
              ? <p className={styles.empty}>No pieces captured yet.</p>
              : <ul className={styles.compactList}>{captured.map((piece) => {
                const player = variant.players.find(({ id }) => id === piece.ownerId);
                const type = variant.pieceTypes.find(({ id }) => id === piece.typeId);
                return <li key={piece.id}>{player?.name ?? piece.ownerId} {type?.name ?? piece.typeId}</li>;
              })}</ul>}
          </section>

          <section aria-labelledby="events-heading">
            <h2 id="events-heading" className={styles.sectionHeading}>Accepted events</h2>
            {session.history.length === 0
              ? <p className={styles.empty}>Accepted moves, captures, turns, and victory will appear here.</p>
              : <ol className={styles.eventLog}>{session.history.flatMap((record, actionIndex) =>
                record.events.map((event, eventIndex) => (
                  <li key={`${actionIndex}-${eventIndex}`}>
                    <span>Ply {event.ply}</span>{describeEvent(event, variant)}
                  </li>
                )),
              )}</ol>}
          </section>
        </aside>
      </div>
    </main>
  );
}

function EngineErrorPanel({ error }: { error: EngineError }) {
  return (
    <section className={styles.error} role="alert" aria-labelledby="engine-error-heading">
      <p className={styles.eyebrow}>Engine rejection</p>
      <h2 id="engine-error-heading">{error.code}</h2>
      <p>{error.message}</p>
      {error.details && <dl>{Object.entries(error.details).map(([key, value]) => (
        <div key={key}><dt>{readable(key)}</dt><dd>{String(value)}</dd></div>
      ))}</dl>}
    </section>
  );
}

function lastBoardMove(session: LocalSession): BoardMove | null {
  const latest = session.history.at(-1)?.events.find(({ type }) => type === "piece-moved");
  if (!latest || latest.type !== "piece-moved") return null;
  return { from: coordinateToSquare(latest.from), to: coordinateToSquare(latest.to) };
}

function describeEvent(event: EngineEvent, variant: LocalSession["variant"]): string {
  switch (event.type) {
    case "piece-moved":
      return `${pieceName(event.pieceId, variant)} moved ${coordinateToSquare(event.from)} to ${coordinateToSquare(event.to)}.`;
    case "piece-captured":
      return `${pieceName(event.piece.id, variant)} was captured on ${coordinateToSquare(event.at)}.`;
    case "turn-changed":
      return `Turn changed to ${playerName(event.toPlayerId, variant)}.`;
    case "game-ended":
      return `${playerName(event.outcome.winnerPlayerId, variant)} won by capturing the royal.`;
  }
}

function pieceName(pieceId: string, variant: LocalSession["variant"]): string {
  const piece = variant.setup.find(({ id }) => id === pieceId);
  const owner = variant.players.find(({ id }) => id === piece?.ownerId);
  const type = variant.pieceTypes.find(({ id }) => id === piece?.typeId);
  return `${owner?.name ?? piece?.ownerId ?? "Unknown"} ${type?.name ?? piece?.typeId ?? pieceId}`;
}

function playerName(playerId: string, variant: LocalSession["variant"]): string {
  return variant.players.find(({ id }) => id === playerId)?.name ?? playerId;
}

function readable(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}
