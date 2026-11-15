import { describe, expect, it } from "vitest";
import { firstFlightDemonstration, firstFlightVariant, longWalkVariant } from "./fixtures";
import {
  applyAction,
  coordinateToSquare,
  createInitialState,
  evaluateOutcome,
  getLegalActions,
  parseVariantDefinition,
  squareToCoordinate,
  type ApplyActionValue,
  type Coordinate,
  type EngineEvent,
  type GameState,
  type MoveAction,
  type ObjectiveDefinition,
  type PiecePlacement,
  type PieceTypeDefinition,
  type VariantDefinition,
} from "./index";

const adjacent = [
  { fileDelta: -1, rankDelta: -1 },
  { fileDelta: 0, rankDelta: -1 },
  { fileDelta: 1, rankDelta: -1 },
  { fileDelta: -1, rankDelta: 0 },
  { fileDelta: 1, rankDelta: 0 },
  { fileDelta: -1, rankDelta: 1 },
  { fileDelta: 0, rankDelta: 1 },
  { fileDelta: 1, rankDelta: 1 },
] as const;

const king: PieceTypeDefinition = {
  id: "king",
  name: "King",
  royal: false,
  movements: [{ kind: "step", frame: "board", mode: "move-or-capture", offsets: adjacent }],
};

const runner: PieceTypeDefinition = {
  id: "runner",
  name: "Runner",
  royal: false,
  movements: [
    {
      kind: "step",
      frame: "owner",
      mode: "move-or-capture",
      offsets: [
        { fileDelta: 0, rankDelta: 1 },
        { fileDelta: 1, rankDelta: 1 },
        { fileDelta: -1, rankDelta: 1 },
      ],
    },
  ],
};

const rook: PieceTypeDefinition = {
  id: "rook",
  name: "Rook",
  royal: false,
  movements: [
    {
      kind: "slide",
      frame: "board",
      mode: "move-or-capture",
      directions: [
        { fileDelta: -1, rankDelta: 0 },
        { fileDelta: 1, rankDelta: 0 },
        { fileDelta: 0, rankDelta: -1 },
        { fileDelta: 0, rankDelta: 1 },
      ],
    },
  ],
};

/** White aims for a5 or e5 and Black for a1 or e1, optionally restricted to runners. */
function reachTargetObjective(eligiblePieceTypeIds?: readonly string[]): ObjectiveDefinition {
  const eligible = eligiblePieceTypeIds ? { eligiblePieceTypeIds } : {};

  return {
    type: "reach-target",
    requireAction: true,
    targets: [
      { playerId: "white", cells: [sq("a5"), sq("e5")], ...eligible },
      { playerId: "black", cells: [sq("a1"), sq("e1")], ...eligible },
    ],
  };
}

describe("reach-target", () => {
  it("wins for White when an eligible piece completes a move onto White's target", () => {
    let state = start(longWalkVariant);
    state = play(longWalkVariant, state, move("white-runner", "a2")).state;
    state = play(longWalkVariant, state, move("black-runner", "c2")).state;

    const result = play(longWalkVariant, state, move("white-runner", "a3"));
    const outcome = {
      type: "win",
      reason: "reach-target",
      winnerPlayerId: "white",
      loserPlayerId: "black",
      pieceId: "white-runner",
      target: sq("a3"),
    };

    expect(result.events).toEqual([
      { type: "piece-moved", ply: 3, pieceId: "white-runner", ownerId: "white", from: sq("a2"), to: sq("a3") },
      { type: "game-ended", ply: 3, outcome },
    ]);
    expect(result.state).toEqual({
      variantId: "the-long-walk",
      ply: 3,
      activePlayerId: null,
      pieces: [
        { id: "white-runner", typeId: "runner", ownerId: "white", at: sq("a3") },
        { id: "black-runner", typeId: "runner", ownerId: "black", at: sq("c2") },
      ],
      outcome,
    });
    expect(evaluateOutcome(longWalkVariant, result.state)).toEqual(outcome);
  });

  it("wins for Black on Black's own target", () => {
    const blackFirst = parse({ ...longWalkVariant, turnOrder: ["black", "white"] });
    let state = start(blackFirst);
    state = play(blackFirst, state, move("black-runner", "c2")).state;
    state = play(blackFirst, state, move("white-runner", "a2")).state;

    const result = play(blackFirst, state, move("black-runner", "c1"));

    expect(result.state).toMatchObject({ ply: 3, activePlayerId: null });
    expect(result.state.outcome).toEqual({
      type: "win",
      reason: "reach-target",
      winnerPlayerId: "black",
      loserPlayerId: "white",
      pieceId: "black-runner",
      target: sq("c1"),
    });
  });

  it.each([
    ["the first", "b4", "a5"],
    ["a later", "d4", "e5"],
  ])("wins on %s configured target, with every piece type eligible by default", (_label, from, target) => {
    const variant = sandbox(reachTargetObjective(), [
      placement("white-king", "king", "white", from),
      placement("black-king", "king", "black", "c2"),
    ]);

    expect(play(variant, start(variant), move("white-king", target)).state.outcome).toEqual({
      type: "win",
      reason: "reach-target",
      winnerPlayerId: "white",
      loserPlayerId: "black",
      pieceId: "white-king",
      target: sq(target),
    });
  });

  it("ignores ineligible piece types and wins with an eligible one", () => {
    const variant = sandbox(
      reachTargetObjective(["runner"]),
      [
        placement("white-king", "king", "white", "a4"),
        placement("white-runner", "runner", "white", "d4"),
        placement("black-king", "king", "black", "c2"),
      ],
    );
    const kingOnTarget = play(variant, start(variant), move("white-king", "a5"));

    expect(kingOnTarget.state).toMatchObject({ ply: 1, activePlayerId: "black", outcome: null });
    expect(kingOnTarget.events.map(({ type }) => type)).toEqual(["piece-moved", "turn-changed"]);

    const state = play(variant, kingOnTarget.state, move("black-king", "c3")).state;

    expect(play(variant, state, move("white-runner", "e5")).state.outcome).toMatchObject({
      reason: "reach-target",
      pieceId: "white-runner",
      target: sq("e5"),
    });
  });

  it("does not win on the other player's target", () => {
    const variant = sandbox(reachTargetObjective(), [
      placement("white-king", "king", "white", "d2"),
      placement("black-king", "king", "black", "c4"),
    ]);
    const result = play(variant, start(variant), move("white-king", "e1"));

    expect(result.state).toMatchObject({ ply: 1, activePlayerId: "black", outcome: null });
    expect(result.events.at(-1)).toEqual({ type: "turn-changed", ply: 1, fromPlayerId: "white", toPlayerId: "black" });
  });

  it("does not win from an initial placement or by moving off, only by an accepted move back on", () => {
    const variant = sandbox(reachTargetObjective(), [
      placement("white-king", "king", "white", "a5"),
      placement("black-king", "king", "black", "c2"),
    ]);
    const initial = start(variant);

    expect(initial.outcome).toBeNull();
    expect(evaluateOutcome(variant, initial)).toBeNull();

    let state = play(variant, initial, move("white-king", "a4")).state;
    expect(state).toMatchObject({ ply: 1, activePlayerId: "black", outcome: null });

    state = play(variant, state, move("black-king", "c3")).state;

    expect(play(variant, state, move("white-king", "a5")).state.outcome).toMatchObject({
      reason: "reach-target",
      winnerPlayerId: "white",
      target: sq("a5"),
    });
  });

  it("treats a capture on a target as one action ending the game, then rejects later actions", () => {
    const variant = sandbox(reachTargetObjective(), [
      placement("white-king", "king", "white", "b4"),
      placement("black-king", "king", "black", "a5"),
      placement("black-rook", "rook", "black", "e3"),
    ]);
    const initial = start(variant);
    const result = play(variant, initial, move("white-king", "a5"));
    const outcome = {
      type: "win",
      reason: "reach-target",
      winnerPlayerId: "white",
      loserPlayerId: "black",
      pieceId: "white-king",
      target: sq("a5"),
    };

    expect(result.events).toEqual([
      { type: "piece-moved", ply: 1, pieceId: "white-king", ownerId: "white", from: sq("b4"), to: sq("a5") },
      {
        type: "piece-captured",
        ply: 1,
        piece: { id: "black-king", typeId: "king", ownerId: "black", at: sq("a5") },
        byPieceId: "white-king",
        at: sq("a5"),
      },
      { type: "game-ended", ply: 1, outcome },
    ]);
    expect(result.state).toEqual({
      variantId: variant.id,
      ply: 1,
      activePlayerId: null,
      pieces: [
        { id: "white-king", typeId: "king", ownerId: "white", at: sq("a5") },
        { id: "black-rook", typeId: "rook", ownerId: "black", at: sq("e3") },
      ],
      outcome,
    });

    const before = JSON.stringify(result.state);

    expect(applyAction(variant, result.state, move("black-rook", "e4"))).toMatchObject({
      ok: false,
      error: { code: "GAME_ALREADY_ENDED" },
    });
    expect(getLegalActions(variant, result.state)).toEqual([]);
    expect(JSON.stringify(result.state)).toBe(before);
  });

  it("works on rectangular boards with disabled cells and owner-relative pieces", () => {
    const variant = parse({
      ...baseVariant(),
      id: "narrow-race",
      board: { files: 3, ranks: 4, disabledCells: [sq("b2"), sq("b3")] },
      pieceTypes: [runner],
      setup: [placement("white-runner", "runner", "white", "a1"), placement("black-runner", "runner", "black", "c4")],
      objectives: [
        {
          type: "reach-target",
          requireAction: true,
          targets: [
            { playerId: "white", cells: [sq("a4")] },
            { playerId: "black", cells: [sq("c1")] },
          ],
        },
      ],
    });
    const turns: readonly [MoveAction, readonly string[]][] = [
      [move("white-runner", "a2"), ["a2"]],
      [move("black-runner", "c3"), ["c3"]],
      [move("white-runner", "a3"), ["a3"]],
      [move("black-runner", "c2"), ["c2"]],
      [move("white-runner", "a4"), ["a4", "b4"]],
    ];
    let state = start(variant);

    for (const [action, legalSquares] of turns) {
      expect(getLegalActions(variant, state).map(({ to }) => coordinateToSquare(to))).toEqual(legalSquares);
      state = play(variant, state, action).state;
    }

    expect(state).toMatchObject({ ply: 5, activePlayerId: null });
    expect(state.outcome).toMatchObject({ reason: "reach-target", pieceId: "white-runner", target: sq("a4") });
  });
});

describe("eliminate-all", () => {
  const variant = sandbox({ type: "eliminate-all" }, [
    placement("white-rook", "rook", "white", "a1"),
    placement("black-first", "king", "black", "a3"),
    placement("black-last", "king", "black", "e3"),
  ]);

  it("continues the game after a non-final capture and ends it after the final capture", () => {
    const first = play(variant, start(variant), move("white-rook", "a3"));

    expect(first.events).toEqual([
      { type: "piece-moved", ply: 1, pieceId: "white-rook", ownerId: "white", from: sq("a1"), to: sq("a3") },
      {
        type: "piece-captured",
        ply: 1,
        piece: { id: "black-first", typeId: "king", ownerId: "black", at: sq("a3") },
        byPieceId: "white-rook",
        at: sq("a3"),
      },
      { type: "turn-changed", ply: 1, fromPlayerId: "white", toPlayerId: "black" },
    ]);
    expect(first.state).toMatchObject({ ply: 1, activePlayerId: "black", outcome: null });

    const second = play(variant, first.state, move("black-last", "d3"));

    expect(second.events.map(({ type }) => type)).toEqual(["piece-moved", "turn-changed"]);

    const final = play(variant, second.state, move("white-rook", "d3"));
    const outcome = {
      type: "win",
      reason: "eliminate-all",
      winnerPlayerId: "white",
      loserPlayerId: "black",
      capturedPieceId: "black-last",
    };

    expect(final.events).toEqual([
      { type: "piece-moved", ply: 3, pieceId: "white-rook", ownerId: "white", from: sq("a3"), to: sq("d3") },
      {
        type: "piece-captured",
        ply: 3,
        piece: { id: "black-last", typeId: "king", ownerId: "black", at: sq("d3") },
        byPieceId: "white-rook",
        at: sq("d3"),
      },
      { type: "game-ended", ply: 3, outcome },
    ]);
    expect(final.state).toEqual({
      variantId: variant.id,
      ply: 3,
      activePlayerId: null,
      pieces: [{ id: "white-rook", typeId: "rook", ownerId: "white", at: sq("d3") }],
      outcome,
    });
    expect(applyAction(variant, final.state, move("white-rook", "d4"))).toMatchObject({
      ok: false,
      error: { code: "GAME_ALREADY_ENDED" },
    });
  });

  it("never ends the game on a non-capturing move, even if the opponent has no pieces", () => {
    const initial = start(variant);
    const opponentGone: GameState = { ...initial, pieces: initial.pieces.filter(({ ownerId }) => ownerId === "white") };
    const result = play(variant, opponentGone, move("white-rook", "a2"));

    expect(result.state).toMatchObject({ ply: 1, activePlayerId: "black", outcome: null });
    expect(result.events.map(({ type }) => type)).toEqual(["piece-moved", "turn-changed"]);
    expect(evaluateOutcome(variant, result.state)).toBeNull();
  });

  it("rejects an initially empty opposing army instead of awarding a win", () => {
    const emptyArmy = sandbox({ type: "eliminate-all" }, [placement("white-rook", "rook", "white", "a1")]);

    expect(createInitialState(emptyArmy)).toEqual({
      ok: false,
      error: {
        code: "INVALID_VARIANT",
        message: "Eliminate-all requires at least one starting piece per player.",
        details: { playerId: "black" },
      },
    });
  });
});

describe("capture-royal regression", () => {
  it("plays the complete First Flight demonstration through the public path unchanged", () => {
    let state = start(firstFlightVariant);
    let last: ApplyActionValue | null = null;

    for (const action of firstFlightDemonstration) {
      last = play(firstFlightVariant, state, action);
      state = last.state;

      if (state.outcome === null) expect(last.events.at(-1)?.type).toBe("turn-changed");
    }

    const outcome = {
      type: "win",
      reason: "capture-royal",
      winnerPlayerId: "white",
      loserPlayerId: "black",
      capturedPieceId: "black-sovereign",
    };

    expect(state).toMatchObject({ ply: 9, activePlayerId: null, outcome });
    expect(last?.events).toEqual([
      { type: "piece-moved", ply: 9, pieceId: "white-tower", ownerId: "white", from: sq("b3"), to: sq("b5") },
      {
        type: "piece-captured",
        ply: 9,
        piece: { id: "black-sovereign", typeId: "sovereign", ownerId: "black", at: sq("b5") },
        byPieceId: "white-tower",
        at: sq("b5"),
      },
      { type: "game-ended", ply: 9, outcome },
    ]);
  });
});

describe("objective dispatch", () => {
  it.each([
    ["an unknown objective", [{ type: "king-of-the-hill" }], "king-of-the-hill"],
    ["a missing objective", [], "missing"],
  ])("rejects %s without changing state or ply", (_label, objectives, objectiveType) => {
    const unsupported = { ...firstFlightVariant, objectives } as unknown as VariantDefinition;
    const state = start(firstFlightVariant);
    const before = JSON.stringify(state);

    expect(applyAction(unsupported, state, firstFlightDemonstration[0])).toEqual({
      ok: false,
      error: {
        code: "INVALID_VARIANT",
        message: "The variant objective is not supported by this engine version.",
        details: { objectiveType },
      },
    });
    expect(evaluateOutcome(unsupported, state)).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("determinism and immutability", () => {
  const scenarios: readonly [string, VariantDefinition, readonly MoveAction[]][] = [
    ["capture-royal", firstFlightVariant, firstFlightDemonstration],
    [
      "reach-target",
      longWalkVariant,
      [move("white-runner", "a2"), move("black-runner", "c2"), move("white-runner", "a3")],
    ],
    [
      "eliminate-all",
      sandbox({ type: "eliminate-all" }, [
        placement("white-rook", "rook", "white", "a1"),
        placement("black-first", "king", "black", "a3"),
        placement("black-last", "king", "black", "e3"),
      ]),
      [move("white-rook", "a3"), move("black-last", "d3"), move("white-rook", "d3")],
    ],
  ];

  it.each(scenarios)("leaves %s inputs untouched and returns frozen, repeatable results", (reason, variant, actions) => {
    const frozenVariant = deepFreeze(structuredClone(variant));
    let state = deepFreeze(start(frozenVariant));

    for (const action of actions) {
      const frozenAction = deepFreeze(structuredClone(action));
      const snapshot = JSON.stringify([frozenVariant, state, frozenAction]);
      const first = applyAction(frozenVariant, state, frozenAction);
      const second = applyAction(frozenVariant, state, frozenAction);

      expect(first).toEqual(second);
      expect(JSON.stringify([frozenVariant, state, frozenAction])).toBe(snapshot);
      if (!first.ok) throw new Error(first.error.message);
      expect(first.value.state.ply).toBe(state.ply + 1);
      expect(isDeepFrozen(first.value)).toBe(true);
      state = first.value.state;
    }

    expect(state.outcome?.reason).toBe(reason);
  });

  it.each(scenarios)("replays %s deterministically from its action history", (_label, variant, actions) => {
    const replay = () => {
      let state = start(variant);
      const events: EngineEvent[] = [];

      for (const action of actions) {
        const result = play(variant, state, action);
        events.push(...result.events);
        state = result.state;
      }

      return { state, events };
    };

    expect(replay()).toEqual(replay());
  });
});

function baseVariant() {
  return {
    schemaVersion: 2,
    id: "objective-sandbox",
    name: "Objective Sandbox",
    board: { files: 5, ranks: 5, disabledCells: [] as Coordinate[] },
    players: [
      { id: "white", name: "White", forwardRank: 1 },
      { id: "black", name: "Black", forwardRank: -1 },
    ],
    turnOrder: ["white", "black"],
  } as const;
}

function sandbox(objective: ObjectiveDefinition, setup: readonly PiecePlacement[]): VariantDefinition {
  return parse({ ...baseVariant(), pieceTypes: [king, runner, rook], setup, objectives: [objective] });
}

function parse(input: unknown): VariantDefinition {
  const parsed = parseVariantDefinition(input);
  if (!parsed.ok) throw new Error(`Test variant must satisfy the schema: ${parsed.issues[0]?.message}`);
  return parsed.value;
}

function start(variant: VariantDefinition): GameState {
  const result = createInitialState(variant);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function play(variant: VariantDefinition, state: GameState, action: MoveAction): ApplyActionValue {
  const result = applyAction(variant, state, action);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function placement(id: string, typeId: string, ownerId: string, square: string): PiecePlacement {
  return { id, typeId, ownerId, at: sq(square) };
}

function move(pieceId: string, square: string): MoveAction {
  return { type: "move", pieceId, to: sq(square) };
}

function sq(square: string): Coordinate {
  const coordinate = squareToCoordinate(square);
  if (!coordinate) throw new Error(`Invalid square ${square}`);
  return coordinate;
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }

  return value;
}

function isDeepFrozen(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}
