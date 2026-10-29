import { describe, expect, expectTypeOf, it } from "vitest";
import { firstFlightDemonstration, firstFlightVariant } from "./fixtures";
import {
  coordinateToSquare,
  createInitialState,
  getLegalActions,
  parseVariantDefinition,
  squareToCoordinate,
  type Coordinate,
  type GamePiece,
  type GameState,
  type GetLegalActions,
  type MoveAction,
  type MovementPattern,
  type VariantDefinition,
} from "./index";
// Test-only: replays the demonstration through the confirmed-action kernel from Task 02.
import { applyConfirmedAction } from "./internal/apply-confirmed-action";

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

const orthogonal = [
  { fileDelta: -1, rankDelta: 0 },
  { fileDelta: 1, rankDelta: 0 },
  { fileDelta: 0, rankDelta: -1 },
  { fileDelta: 0, rankDelta: 1 },
] as const;

const king: MovementPattern = { kind: "step", frame: "board", mode: "move-or-capture", offsets: adjacent };
const rook: MovementPattern = { kind: "slide", frame: "board", mode: "move-or-capture", directions: orthogonal };
const east = (mode: MovementPattern["mode"], maxDistance?: number): MovementPattern => ({
  kind: "slide",
  frame: "board",
  mode,
  directions: [{ fileDelta: 1, rankDelta: 0 }],
  ...(maxDistance === undefined ? {} : { maxDistance }),
});

describe("getLegalActions", () => {
  it("implements the public RulesEngine contract", () => {
    expectTypeOf(getLegalActions).toEqualTypeOf<GetLegalActions>();
  });

  describe("vector orientation", () => {
    const offsets = [
      { fileDelta: 1, rankDelta: 2 },
      { fileDelta: -2, rankDelta: -1 },
    ];

    it("applies board-relative vectors identically for both players", () => {
      const variant = sandbox([{ kind: "leap", frame: "board", mode: "move-or-capture", offsets }]);

      expect(destinations(variant, [piece("white-mover", "c3")], "white")).toEqual(["d5", "a2"]);
      expect(destinations(variant, [piece("black-mover", "c3", "black")], "black")).toEqual(["d5", "a2"]);
    });

    it("flips only the rank of owner-relative vectors using forwardRank", () => {
      const variant = sandbox([{ kind: "leap", frame: "owner", mode: "move-or-capture", offsets }]);

      expect(destinations(variant, [piece("white-mover", "c3")], "white")).toEqual(["d5", "a2"]);
      expect(destinations(variant, [piece("black-mover", "c3", "black")], "black")).toEqual(["d1", "a4"]);
    });

    it("orients owner-relative slides for each player", () => {
      const forward: MovementPattern = {
        kind: "slide",
        frame: "owner",
        mode: "move-or-capture",
        directions: [{ fileDelta: 0, rankDelta: 1 }],
      };
      const variant = sandbox([forward]);

      expect(destinations(variant, [piece("white-mover", "c3")], "white")).toEqual(["c4", "c5"]);
      expect(destinations(variant, [piece("black-mover", "c3", "black")], "black")).toEqual(["c2", "c1"]);
    });
  });

  describe("board limits", () => {
    it("keeps steps inside the board at corners and edges", () => {
      const variant = sandbox([king]);

      expect(destinations(variant, [piece("white-mover", "a1")])).toEqual(["b1", "a2", "b2"]);
      expect(destinations(variant, [piece("white-mover", "e5")])).toEqual(["d4", "e4", "d5"]);
      expect(destinations(variant, [piece("white-mover", "c1")])).toEqual(["b1", "d1", "b2", "c2", "d2"]);
    });

    it("never lands on disabled cells and stops slides at them", () => {
      const disabledCells = [squareToCoordinate("b2")!, squareToCoordinate("c4")!, squareToCoordinate("e3")!];

      expect(destinations(sandbox([king], { disabledCells }), [piece("white-mover", "c3")])).toEqual([
        "c2",
        "d2",
        "b3",
        "d3",
        "b4",
        "d4",
      ]);
      expect(destinations(sandbox([rook], { disabledCells }), [piece("white-mover", "c3")])).toEqual([
        "b3",
        "a3",
        "d3",
        "c2",
        "c1",
      ]);
      const leapEast: MovementPattern = {
        kind: "leap",
        frame: "board",
        mode: "move-or-capture",
        offsets: [{ fileDelta: 2, rankDelta: 0 }],
      };

      expect(destinations(sandbox([leapEast], { disabledCells }), [piece("white-mover", "c3")])).toEqual([]);
    });

    it("respects rectangular boards", () => {
      const variant = sandbox([rook], { files: 3, ranks: 6 });

      expect(destinations(variant, [piece("white-mover", "b2")])).toEqual(["a2", "c2", "b1", "b3", "b4", "b5", "b6"]);
    });
  });

  describe("slides", () => {
    it("continues to the edge with no blockers", () => {
      expect(destinations(sandbox([rook]), [piece("white-mover", "c3")])).toEqual([
        "b3",
        "a3",
        "d3",
        "e3",
        "c2",
        "c1",
        "c4",
        "c5",
      ]);
    });

    it("stops before a friendly blocker and never reaches pieces behind it", () => {
      const pieces = [
        piece("white-mover", "a3"),
        piece("white-blocker", "c3", "white", "blocker"),
        piece("black-behind", "d3", "black"),
      ];

      expect(destinations(sandbox([east("move-or-capture")]), pieces)).toEqual(["b3"]);
    });

    it("captures the first enemy blocker and never passes it", () => {
      const pieces = [
        piece("white-mover", "a3"),
        piece("black-blocker", "c3", "black"),
        piece("black-behind", "e3", "black"),
      ];

      expect(destinations(sandbox([east("move-or-capture")]), pieces)).toEqual(["b3", "c3"]);
      expect(destinations(sandbox([east("move-only")]), pieces)).toEqual(["b3"]);
      expect(destinations(sandbox([east("capture-only")]), pieces)).toEqual(["c3"]);
    });

    it("limits the ray to maxDistance", () => {
      expect(destinations(sandbox([east("move-or-capture", 2)]), [piece("white-mover", "a3")])).toEqual(["b3", "c3"]);
    });
  });

  describe("leaps", () => {
    it("ignores occupied intervening cells", () => {
      const variant = sandbox([
        {
          kind: "leap",
          frame: "board",
          mode: "move-or-capture",
          offsets: [
            { fileDelta: 2, rankDelta: 0 },
            { fileDelta: 0, rankDelta: 2 },
            { fileDelta: 2, rankDelta: 2 },
          ],
        },
      ]);
      const pieces = [
        piece("white-mover", "a1"),
        piece("white-wall", "b1", "white", "blocker"),
        piece("black-wall", "a2", "black"),
        piece("black-target", "a3", "black"),
        piece("white-friend", "c3", "white", "blocker"),
      ];

      expect(destinations(variant, pieces)).toEqual(["c1", "a3"]);
    });
  });

  describe("movement modes", () => {
    it.each([
      ["move-only", ["b1"]],
      ["capture-only", ["a2"]],
      ["move-or-capture", ["b1", "a2"]],
    ] as const)("%s distinguishes empty, enemy, and friendly cells", (mode, expected) => {
      const variant = sandbox([
        {
          kind: "step",
          frame: "board",
          mode,
          offsets: [
            { fileDelta: 1, rankDelta: 0 },
            { fileDelta: 0, rankDelta: 1 },
            { fileDelta: 1, rankDelta: 1 },
          ],
        },
      ]);
      const pieces = [
        piece("white-mover", "a1"),
        piece("black-target", "a2", "black"),
        piece("white-friend", "b2", "white", "blocker"),
      ];

      expect(destinations(variant, pieces)).toEqual(expected);
    });
  });

  describe("active player and finished positions", () => {
    const variant = sandbox([king]);
    const pieces = [piece("white-mover", "a1"), piece("black-mover", "e5", "black")];

    it("returns actions only for the active player's pieces", () => {
      expect(getLegalActions(variant, position(variant, pieces, "white")).map(({ pieceId }) => pieceId)).toEqual([
        "white-mover",
        "white-mover",
        "white-mover",
      ]);
      expect(getLegalActions(variant, position(variant, pieces, "black")).map(({ pieceId }) => pieceId)).toEqual([
        "black-mover",
        "black-mover",
        "black-mover",
      ]);
    });

    it("returns no actions for finished games or another variant's state", () => {
      const finished: GameState = {
        ...position(variant, pieces, "white"),
        activePlayerId: null,
        outcome: {
          type: "win",
          reason: "capture-royal",
          winnerPlayerId: "white",
          loserPlayerId: "black",
          capturedPieceId: "black-royal",
        },
      };

      expect(getLegalActions(variant, finished)).toEqual([]);
      expect(getLegalActions({ ...variant, id: "different" }, position(variant, pieces, "white"))).toEqual([]);
    });
  });

  describe("ordering", () => {
    it("removes duplicate destinations while keeping first-reached order", () => {
      const variant = sandbox(
        [
          {
            kind: "step",
            frame: "board",
            mode: "move-or-capture",
            offsets: [
              { fileDelta: 0, rankDelta: 1 },
              { fileDelta: 1, rankDelta: 0 },
            ],
          },
          {
            kind: "slide",
            frame: "board",
            mode: "move-or-capture",
            directions: [
              { fileDelta: 1, rankDelta: 0 },
              { fileDelta: 0, rankDelta: 1 },
            ],
          },
        ],
        { files: 3, ranks: 3 },
      );

      expect(destinations(variant, [piece("white-mover", "a1")])).toEqual(["a2", "b1", "c1", "a3"]);
    });

    it("follows the order of pieces in the state", () => {
      const variant = sandbox([
        { kind: "step", frame: "board", mode: "move-or-capture", offsets: [{ fileDelta: 0, rankDelta: 1 }] },
      ]);
      const first = piece("white-first", "a1");
      const second = piece("white-second", "e1");

      expect(getLegalActions(variant, position(variant, [first, second])).map(describeAction)).toEqual([
        "white-first a2",
        "white-second e2",
      ]);
      expect(getLegalActions(variant, position(variant, [second, first])).map(describeAction)).toEqual([
        "white-second e2",
        "white-first a2",
      ]);
    });
  });

  describe("determinism and immutability", () => {
    it("returns identical frozen output and leaves deeply frozen inputs unchanged", () => {
      const variant = deepFreeze(sandbox([rook, king]));
      const state = deepFreeze(position(variant, [piece("white-mover", "c3"), piece("black-target", "c5", "black")]));
      const variantBefore = JSON.stringify(variant);
      const stateBefore = JSON.stringify(state);
      const first = getLegalActions(variant, state);

      expect(getLegalActions(variant, state)).toEqual(first);
      expect(JSON.stringify(variant)).toBe(variantBefore);
      expect(JSON.stringify(state)).toBe(stateBefore);
      expect(Object.isFrozen(first)).toBe(true);
      expect(first.every((action) => Object.isFrozen(action) && Object.isFrozen(action.to))).toBe(true);
    });
  });

  describe("First Flight", () => {
    // Hand-derived for every position of the demonstration; the final position is a white win.
    const expectedByPosition: readonly (readonly string[])[] = [
      [
        "white-tower b1",
        "white-tower a2",
        "white-tower a3",
        "white-tower a4",
        "white-tower a5",
        "white-sovereign b1",
        "white-sovereign d1",
        "white-sovereign b2",
        "white-sovereign c2",
        "white-sovereign d2",
        "white-hopper c2",
        "white-hopper d3",
      ],
      [
        "black-hopper b3",
        "black-hopper c4",
        "black-sovereign b4",
        "black-sovereign c4",
        "black-sovereign d4",
        "black-sovereign b5",
        "black-sovereign d5",
        "black-tower d5",
        "black-tower e4",
        "black-tower e3",
        "black-tower e2",
        "black-tower e1",
      ],
      [
        "white-tower b4",
        "white-tower c4",
        "white-tower d4",
        "white-tower e4",
        "white-tower a3",
        "white-tower a2",
        "white-tower a1",
        "white-tower a5",
        "white-sovereign b1",
        "white-sovereign d1",
        "white-sovereign b2",
        "white-sovereign c2",
        "white-sovereign d2",
        "white-hopper c2",
        "white-hopper d3",
      ],
      [
        "black-hopper a1",
        "black-hopper a5",
        "black-hopper c1",
        "black-hopper d2",
        "black-hopper d4",
        "black-sovereign b4",
        "black-sovereign c4",
        "black-sovereign d4",
        "black-sovereign b5",
        "black-sovereign d5",
        "black-tower d5",
        "black-tower e4",
        "black-tower e3",
        "black-tower e2",
        "black-tower e1",
      ],
      [
        "white-tower b4",
        "white-tower c4",
        "white-tower d4",
        "white-tower e4",
        "white-tower a3",
        "white-tower a2",
        "white-tower a1",
        "white-tower a5",
        "white-sovereign a1",
        "white-sovereign b1",
        "white-sovereign c1",
        "white-sovereign a2",
        "white-sovereign c2",
        "white-sovereign a3",
        "white-sovereign b3",
        "white-sovereign c3",
        "white-hopper c2",
        "white-hopper d3",
      ],
      [
        "black-hopper a1",
        "black-hopper a5",
        "black-hopper c1",
        "black-hopper c5",
        "black-hopper d2",
        "black-hopper d4",
        "black-sovereign a4",
        "black-sovereign b4",
        "black-sovereign c4",
        "black-sovereign a5",
        "black-sovereign c5",
        "black-tower d5",
        "black-tower c5",
        "black-tower e4",
        "black-tower e3",
        "black-tower e2",
        "black-tower e1",
      ],
      [
        "white-tower a4",
        "white-tower c4",
        "white-tower d4",
        "white-tower e4",
        "white-tower b3",
        "white-tower b5",
        "white-sovereign a1",
        "white-sovereign b1",
        "white-sovereign c1",
        "white-sovereign a2",
        "white-sovereign c2",
        "white-sovereign a3",
        "white-sovereign b3",
        "white-sovereign c3",
        "white-hopper c2",
        "white-hopper d3",
      ],
      [
        "black-sovereign a4",
        "black-sovereign b4",
        "black-sovereign c4",
        "black-sovereign a5",
        "black-sovereign c5",
        "black-tower d2",
        "black-tower c2",
        "black-tower b2",
        "black-tower e1",
        "black-tower e3",
        "black-tower e4",
        "black-tower e5",
      ],
      [
        "white-tower a3",
        "white-tower c3",
        "white-tower d3",
        "white-tower e3",
        "white-tower b4",
        "white-tower b5",
        "white-sovereign a1",
        "white-sovereign b1",
        "white-sovereign c1",
        "white-sovereign a2",
        "white-sovereign c2",
        "white-sovereign a3",
        "white-sovereign c3",
      ],
      [],
    ];

    it("produces the exact legal actions at the initial and every demonstration position", () => {
      let state = initialFirstFlightState();

      expect(expectedByPosition).toHaveLength(firstFlightDemonstration.length + 1);

      firstFlightDemonstration.forEach((action, index) => {
        const actions = getLegalActions(firstFlightVariant, state);

        expect(actions.map(describeAction), `position ${index}`).toEqual(expectedByPosition[index]);
        expect(actions).toContainEqual(action);

        const result = applyConfirmedAction(firstFlightVariant, state, action);
        if (!result.ok) throw new Error(result.error.message);
        state = result.value.state;
      });

      expect(state.outcome).toMatchObject({ winnerPlayerId: "white", capturedPieceId: "black-sovereign" });
      expect(getLegalActions(firstFlightVariant, state).map(describeAction)).toEqual(expectedByPosition.at(-1));
    });
  });
});

/**
 * A schema-valid variant with a configurable "mover" type and an immobile
 * "blocker" type. Positions are built directly so tests control occupancy.
 */
function sandbox(
  movements: readonly MovementPattern[],
  board: Partial<VariantDefinition["board"]> = {},
): VariantDefinition {
  const immobile: MovementPattern = {
    kind: "step",
    frame: "board",
    mode: "capture-only",
    offsets: [{ fileDelta: 0, rankDelta: 1 }],
  };
  const parsed = parseVariantDefinition({
    ...firstFlightVariant,
    id: "sandbox",
    name: "Sandbox",
    board: { files: 5, ranks: 5, disabledCells: [], ...board },
    pieceTypes: [
      { id: "mover", name: "Mover", royal: false, movements },
      { id: "blocker", name: "Blocker", royal: false, movements: [immobile] },
    ],
    setup: [{ id: "placeholder", typeId: "mover", ownerId: "white", at: { file: 0, rank: 0 } }],
  });

  if (!parsed.ok) throw new Error(`Sandbox variant must satisfy the schema: ${parsed.issues[0]?.message}`);

  return parsed.value;
}

function piece(id: string, square: string, ownerId = "white", typeId = "mover"): GamePiece {
  return { id, typeId, ownerId, at: coordinate(square) };
}

function position(variant: VariantDefinition, pieces: readonly GamePiece[], activePlayerId = "white"): GameState {
  return { variantId: variant.id, ply: 0, activePlayerId, pieces, outcome: null };
}

function destinations(variant: VariantDefinition, pieces: readonly GamePiece[], activePlayerId = "white"): string[] {
  const moverId = pieces[0]?.id;

  return getLegalActions(variant, position(variant, pieces, activePlayerId))
    .filter(({ pieceId }) => pieceId === moverId)
    .map(({ to }) => coordinateToSquare(to));
}

function coordinate(square: string): Coordinate {
  const value = squareToCoordinate(square);
  if (!value) throw new Error(`Invalid square ${square}`);
  return value;
}

function describeAction(action: MoveAction): string {
  return `${action.pieceId} ${coordinateToSquare(action.to)}`;
}

function initialFirstFlightState(): GameState {
  const result = createInitialState(firstFlightVariant);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }

  return value;
}
