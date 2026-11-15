import { describe, expect, it } from "vitest";
import { squareToCoordinate, type EngineEvent } from "@rookery/rules";
import { firstFlightDemonstration, firstFlightVariant, lastFlockStandingVariant, longWalkVariant } from "@rookery/rules/fixtures";
import { createLocalSession, submitLocalAction, type LocalSession } from "./local-session";
import {
  announceAcceptedAction,
  boardTargets,
  describeEvent,
  describeOutcome,
  objectiveSummary,
  pieceName,
  playerTargets,
  remainingPieces,
} from "./objective-presentation";
import { crossroadsMoves, crossroadsVariant, lastFlockMoves, longWalkMoves } from "./objective-test-fixtures";

describe("objective summary", () => {
  it("names each objective with one instruction sentence", () => {
    expect(objectiveSummary(firstFlightVariant)).toEqual({
      type: "capture-royal",
      title: "Capture the royal",
      instructions: "Win by capturing your opponent's royal piece.",
    });
    expect(objectiveSummary(longWalkVariant)?.title).toBe("Reach a target");
    expect(objectiveSummary(longWalkVariant)?.instructions).toMatch(/starting on one does not count/);
    expect(objectiveSummary(lastFlockStandingVariant)?.title).toBe("Eliminate all opponents");
  });
});

describe("targets", () => {
  it("lists each player's configured cells and eligible types", () => {
    expect(playerTargets(start(crossroadsVariant).variant)).toEqual([
      { playerId: "white", playerName: "White", side: "white", squares: ["a3"], eligibility: "Runner" },
      { playerId: "black", playerName: "Black", side: "black", squares: ["c1", "b3"], eligibility: "Runner" },
    ]);
  });

  it("explains unrestricted targets as any piece", () => {
    const anyPiece = withTargets([{ playerId: "white", cells: [{ file: 0, rank: 2 }] }, { playerId: "black", cells: [{ file: 2, rank: 0 }] }]);
    expect(playerTargets(anyPiece).map(({ eligibility }) => eligibility)).toEqual(["Any piece", "Any piece"]);
  });

  it("is empty for objectives without targets", () => {
    expect(playerTargets(firstFlightVariant)).toEqual([]);
    expect(boardTargets(lastFlockStandingVariant, null)).toEqual([]);
  });

  it("marks every configured cell with its owner", () => {
    expect(boardTargets(start(crossroadsVariant).variant, null)).toEqual([
      { square: "a3", side: "white", label: "White target" },
      { square: "c1", side: "black", label: "Black target" },
      { square: "b3", side: "black", label: "Black target" },
    ]);
  });

  it("describes configured eligibility for the selected piece without calling any move a win", () => {
    const session = start(crossroadsVariant);
    const runner = session.state.pieces.find(({ id }) => id === "white-runner")!;
    const guard = session.state.pieces.find(({ id }) => id === "white-guard")!;

    expect(boardTargets(session.variant, runner).map(({ label }) => label)).toEqual([
      "White target, selected piece eligible",
      "Black target, selected piece not eligible",
      "Black target, selected piece not eligible",
    ]);
    expect(boardTargets(session.variant, guard)[0]?.label).toBe("White target, selected piece not eligible");
    expect(boardTargets(session.variant, runner).some(({ label }) => /win/i.test(label))).toBe(false);
  });
});

describe("remaining pieces", () => {
  it("counts only what the engine state still holds", () => {
    let session = start(lastFlockStandingVariant);
    expect(remainingPieces(session.variant, session.state).map(({ count }) => count)).toEqual([4, 4]);

    session = play(session, lastFlockMoves.slice(0, 1));
    expect(remainingPieces(session.variant, session.state)).toEqual([
      { playerId: "white", playerName: "White", count: 4 },
      { playerId: "black", playerName: "Black", count: 3 },
    ]);

    session = play(session, lastFlockMoves.slice(1));
    expect(remainingPieces(session.variant, session.state).map(({ count }) => count)).toEqual([4, 0]);
  });
});

describe("outcomes and events from real engine results", () => {
  it("presents capture-royal from the structured outcome", () => {
    const session = playActions(start(firstFlightVariant));
    expect(describeOutcome(session.state.outcome!, session.variant)).toEqual({
      headline: "White wins",
      detail: "Victory by capturing the opposing royal: Black Sovereign.",
    });
    expect(lastEvent(session)).toBe("White won by capturing the royal, Black Sovereign.");
  });

  it("presents reach-target with the piece and target from the outcome", () => {
    const session = play(start(longWalkVariant), longWalkMoves);
    expect(session.state.outcome?.reason).toBe("reach-target");
    expect(describeOutcome(session.state.outcome!, session.variant)).toEqual({
      headline: "White wins",
      detail: "Victory by reaching a target: White Runner reached a3.",
    });
    expect(lastEvent(session)).toBe("White won: White Runner reached target a3.");
    expect(announceAcceptedAction(session.history.at(-1)!.events, session.variant))
      .toBe("White Runner moved a2 to a3. White won: White Runner reached target a3.");
  });

  it("stays silent about wins until the engine reports an outcome", () => {
    let session = start(crossroadsVariant);

    for (const [index, move] of crossroadsMoves.entries()) {
      session = play(session, [move]);
      const announcement = announceAcceptedAction(session.history.at(-1)!.events, session.variant);
      if (index < crossroadsMoves.length - 1) {
        expect(session.state.outcome).toBeNull();
        expect(announcement).not.toMatch(/won|wins/);
      }
    }

    expect(describeOutcome(session.state.outcome!, session.variant).detail)
      .toBe("Victory by reaching a target: Black Runner reached c1.");
  });

  it("presents eliminate-all with the final captured piece", () => {
    const session = play(start(lastFlockStandingVariant), lastFlockMoves);
    expect(describeOutcome(session.state.outcome!, session.variant)).toEqual({
      headline: "White wins",
      detail: "Victory by elimination: Black Tower was Black's last piece.",
    });
    expect(announceAcceptedAction(session.history.at(-1)!.events, session.variant))
      .toBe("White Nightrider moved e1 to a3, capturing Black Tower. White won by capturing Black Tower, Black's last piece.");
  });

  it("announces ordinary moves and captures with the next player", () => {
    const session = play(start(lastFlockStandingVariant), lastFlockMoves.slice(0, 2));
    expect(announceAcceptedAction(session.history[0]!.events, session.variant))
      .toBe("White Chancellor moved a1 to a5, capturing Black Nightrider. Black to move.");
    expect(announceAcceptedAction(session.history[1]!.events, session.variant))
      .toBe("Black Tower moved b5 to b4. White to move.");
  });

  it("describes every event type", () => {
    const session = play(start(lastFlockStandingVariant), lastFlockMoves);
    const lines = session.history.flatMap(({ events }) => events.map((event: EngineEvent) => describeEvent(event, session.variant)));
    expect(lines.slice(0, 3)).toEqual([
      "White Chancellor moved a1 to a5.",
      "Black Nightrider was captured on a5.",
      "Turn changed to Black.",
    ]);
    expect(lines.at(-1)).toBe("White won by capturing Black Tower, Black's last piece.");
  });

  it("keeps stable IDs behind display names", () => {
    expect(pieceName(longWalkVariant, "white-runner")).toBe("White Runner");
    expect(pieceName(longWalkVariant, "unknown-piece")).toBe("unknown-piece");
  });
});

function start(variant: unknown): LocalSession {
  const result = createLocalSession(variant);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function play(session: LocalSession, moves: readonly (readonly [string, string])[]): LocalSession {
  return moves.reduce((current, [from, to]) => {
    const fromAt = squareToCoordinate(from)!;
    const piece = current.state.pieces.find(({ at }) => at.file === fromAt.file && at.rank === fromAt.rank);
    if (!piece) throw new Error(`No piece on ${from}`);
    const result = submitLocalAction(current, { type: "move", pieceId: piece.id, to: squareToCoordinate(to)! });
    if (!result.ok) throw new Error(`${from}-${to}: ${result.error.code}`);
    return result.value;
  }, session);
}

function playActions(session: LocalSession): LocalSession {
  return firstFlightDemonstration.reduce((current, action) => {
    const result = submitLocalAction(current, action);
    if (!result.ok) throw new Error(result.error.code);
    return result.value;
  }, session);
}

function lastEvent(session: LocalSession): string {
  const event = session.history.at(-1)!.events.at(-1)!;
  return describeEvent(event, session.variant);
}

function withTargets(targets: unknown) {
  return start({ ...longWalkVariant, objectives: [{ type: "reach-target", requireAction: true, targets }] }).variant;
}
