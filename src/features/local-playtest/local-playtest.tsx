"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  coordinateToSquare,
  getLegalActions,
  squareToCoordinate,
  type EngineError,
  type MoveAction,
} from "@rookery/rules";
import { BoardSurface, type BoardMove, type SquareActivation } from "@/components/board-surface";
import { variantBoardPieces } from "@/features/variant-board/board-adapter";
import { SessionPieceArt } from "@/features/piece-library/appearance";
import rookeryLogo from "../../app/icon.png";
import {
  resetLocalSession,
  submitLocalAction,
  type LocalSession,
} from "./local-session";
import {
  announceAcceptedAction,
  boardTargets,
  describeEvent,
  describeOutcome,
  objectiveSummary,
  playerTargets,
  remainingPieces,
} from "./objective-presentation";
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
  const objective = objectiveSummary(variant);
  const targets = playerTargets(variant);
  const outcome = state.outcome ? describeOutcome(state.outcome, variant) : null;
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
    setMessage(announceAcceptedAction(result.value.history.at(-1)?.events ?? [], variant));
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
          {objective && (
            <p className={styles.objective}>
              <strong>{objective.title}.</strong> {objective.instructions}
            </p>
          )}
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
              targets={boardTargets(variant, selectedPiece)}
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
          <section className={styles.gameStatus} data-finished={Boolean(outcome) || undefined}>
            <p className={styles.eyebrow}>{outcome ? "Game over" : "Current status"}</p>
            <h2>{outcome ? outcome.headline : `${activePlayer?.name ?? "Unknown player"} to move`}</h2>
            <p>
              {outcome
                ? `${outcome.detail} Board input is now locked; reset to play again.`
                : `${selectedActions.length} legal move${selectedActions.length === 1 ? "" : "s"}${selectedPiece ? " for the selected piece" : " available after selecting a piece"}.`}
            </p>
          </section>

          {objective?.type === "reach-target" && (
            <section aria-labelledby="targets-heading">
              <h2 id="targets-heading" className={styles.sectionHeading}>Targets</h2>
              <ul className={styles.targetList}>
                {targets.map((target) => (
                  <li key={target.playerId}>
                    <span className={styles.targetKey} data-side={target.side} aria-hidden="true" />
                    <div>
                      <strong>{target.playerName}</strong>
                      <span>{target.squares.join(", ")}</span>
                      <span>
                        {target.side === "white" ? "Corner brackets" : "Dashed ring"} · {target.eligibility === "Any piece" ? "any piece can win" : `eligible: ${target.eligibility}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {objective?.type === "eliminate-all" && (
            <section aria-labelledby="remaining-heading">
              <h2 id="remaining-heading" className={styles.sectionHeading}>Pieces remaining</h2>
              <dl className={styles.remaining}>
                {remainingPieces(variant, state).map((entry) => (
                  <div key={entry.playerId}>
                    <dt>{entry.playerName}</dt>
                    <dd>{entry.count}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

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

function readable(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}
