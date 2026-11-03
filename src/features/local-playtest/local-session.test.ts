import { describe, expect, it } from "vitest";
import { firstFlightDemonstration, firstFlightVariant } from "@rookery/rules/fixtures";
import {
  createLocalSession,
  resetLocalSession,
  submitLocalAction,
  type LocalSession,
} from "./local-session";

describe("local session", () => {
  it("blocks malformed and semantically invalid drafts before initialization", () => {
    expect(createLocalSession({ name: "missing fields" })).toMatchObject({
      ok: false,
      error: { code: "PARSE_FAILED" },
    });

    const withoutRoyal = {
      ...firstFlightVariant,
      setup: firstFlightVariant.setup.filter(({ id }) => id !== "white-sovereign"),
    };
    expect(createLocalSession(withoutRoyal)).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        issues: [{ code: "INVALID_ROYAL_COUNT", path: ["players", 0] }],
      },
    });
  });

  it("updates state and ordered history exactly once for an accepted action", () => {
    const session = start();
    const result = submitLocalAction(session, firstFlightDemonstration[0]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toMatchObject({ ply: 1, activePlayerId: "black" });
    expect(result.value.history).toEqual([
      {
        action: firstFlightDemonstration[0],
        events: [
          expect.objectContaining({ type: "piece-moved", ply: 1 }),
          expect.objectContaining({ type: "turn-changed", ply: 1 }),
        ],
      },
    ]);
    expect(session.state.ply).toBe(0);
    expect(session.history).toEqual([]);
  });

  it("returns a structured rejection without changing session state or history", () => {
    const session = start();
    const snapshot = structuredClone(session);
    const result = submitLocalAction(session, {
      type: "move",
      pieceId: "white-tower",
      to: { file: 1, rank: 1 },
    });

    expect(result).toMatchObject({ ok: false, error: { code: "ACTION_NOT_LEGAL" } });
    expect(session).toEqual(snapshot);
  });

  it("replays First Flight deterministically and resets to the exact initial position", () => {
    const play = () => {
      let session = start();
      for (const action of firstFlightDemonstration) {
        const result = submitLocalAction(session, action);
        if (!result.ok) throw new Error(result.error.message);
        session = result.value;
      }
      return session;
    };

    const completed = play();
    expect(play()).toEqual(completed);
    expect(completed.history).toHaveLength(firstFlightDemonstration.length);
    expect(completed.state.outcome).toMatchObject({ winnerPlayerId: "white" });

    const reset = resetLocalSession(completed);
    expect(reset.state).toBe(completed.initialState);
    expect(reset.state.ply).toBe(0);
    expect(reset.history).toEqual([]);
  });
});

function start(): LocalSession {
  const result = createLocalSession(firstFlightVariant);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
