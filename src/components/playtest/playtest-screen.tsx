"use client";

import { BoardSurface, PieceArt } from "@/components/board-surface";
import { usePlaytest } from "./playtest-controller";
import type { PlaytestEvent, PlaytestSession } from "./session";
import styles from "./playtest-screen.module.css";

type PlaytestScreenProps = {
  session: PlaytestSession;
  /** Leaves the playtest, e.g. back to the editor. Hidden when omitted. */
  onExit?: () => void;
};

export function PlaytestScreen({ session, onExit }: PlaytestScreenProps) {
  const { view, activate, choosePromotion, cancelPromotion, reset } = usePlaytest(session);
  const { snapshot, selected, actions, promotionChoices, error, log } = view;
  const { outcome } = snapshot;

  const status = outcome
    ? outcome.winner
      ? `${capitalize(outcome.winner)} wins by ${outcome.reason}`
      : `Draw by ${outcome.reason}`
    : `${capitalize(snapshot.activeSide)} to move`;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Playtest</p>
          <h1 className={styles.title}>{snapshot.variantName}</h1>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Turn</dt>
            <dd>{snapshot.turnNumber}</dd>
          </div>
          <div>
            <dt>To move</dt>
            <dd className={styles.side} data-side={outcome ? undefined : snapshot.activeSide}>
              {outcome ? "—" : capitalize(snapshot.activeSide)}
            </dd>
          </div>
        </dl>
      </header>

      <div className={styles.layout}>
        <div className={styles.boardColumn}>
          <BoardSurface
            files={snapshot.files}
            ranks={snapshot.ranks}
            pieces={snapshot.pieces}
            label={`${snapshot.variantName} playtest board`}
            selectedSquare={selected}
            legalDestinations={actions.filter((action) => !action.captures).map((action) => action.to)}
            captureDestinations={actions.filter((action) => action.captures).map((action) => action.to)}
            lastMove={snapshot.lastMove}
            checkSquares={snapshot.checkSquares}
            disabledSquares={snapshot.disabledSquares}
            disabled={Boolean(outcome) || Boolean(promotionChoices)}
            onSquareActivate={activate}
          />

          {promotionChoices && (
            <div className={styles.promotion} role="dialog" aria-label="Choose a promotion">
              <p>Promote to</p>
              {promotionChoices.map((choice) => (
                <button key={choice.promotion} type="button" onClick={() => choosePromotion(choice)}>
                  <PieceArt kind={choice.promotion ?? "queen"} side={snapshot.activeSide} />
                  <span>{choice.promotion}</span>
                </button>
              ))}
              <button type="button" onClick={cancelPromotion}>
                Cancel
              </button>
            </div>
          )}
        </div>

        <aside className={styles.panel}>
          <p className={styles.status} role="status" data-over={outcome ? true : undefined}>
            {status}
          </p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <section aria-labelledby="playtest-events">
            <h2 id="playtest-events" className={styles.heading}>
              Events
            </h2>
            {log.length === 0 ? (
              <p className={styles.empty}>Captures and checks will appear here.</p>
            ) : (
              <ol className={styles.log}>
                {log.map(({ turn, event }, index) => (
                  <li key={log.length - index}>
                    <span className={styles.turn}>{turn}.</span> {describeEvent(event)}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className={styles.controls}>
            <button type="button" className={styles.button} onClick={reset}>
              Reset
            </button>
            {onExit && (
              <button type="button" className={styles.button} onClick={onExit}>
                Exit playtest
              </button>
            )}
          </div>
          <p className={styles.hint}>Reset returns every piece to the variant&apos;s starting position.</p>
        </aside>
      </div>
    </div>
  );
}

function describeEvent(event: PlaytestEvent): string {
  switch (event.type) {
    case "capture":
      return `${capitalize(event.piece.side)} ${event.piece.kind} captured on ${event.square}`;
    case "promotion":
      return `Pawn promoted to ${event.piece.kind} on ${event.square}`;
    case "check":
      return `${capitalize(event.side)} is in check`;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
