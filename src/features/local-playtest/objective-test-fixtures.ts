/*
 * Test-only data. Each sequence was produced and is re-checked by the shared
 * engine; nothing here predicts an outcome.
 */

const forwardStep = [{
  kind: "step",
  frame: "owner",
  mode: "move-or-capture",
  offsets: [{ fileDelta: 0, rankDelta: 1 }],
}] as const;

/**
 * A 3×4 reach-target variant where only Runners are eligible. White's Guard can
 * stand on White's own target, and White's Runner can stand on one of Black's
 * targets, without either ending the game. Black's Runner then wins on c1.
 */
export const crossroadsVariant = {
  schemaVersion: 2,
  id: "crossroads",
  name: "Crossroads",
  board: { files: 3, ranks: 4, disabledCells: [] },
  players: [
    { id: "white", name: "White", forwardRank: 1 },
    { id: "black", name: "Black", forwardRank: -1 },
  ],
  turnOrder: ["white", "black"],
  pieceTypes: [
    { id: "runner", name: "Runner", royal: false, movements: forwardStep },
    { id: "guard", name: "Guard", royal: false, movements: forwardStep },
  ],
  setup: [
    { id: "white-runner", typeId: "runner", ownerId: "white", at: { file: 1, rank: 0 } },
    { id: "white-guard", typeId: "guard", ownerId: "white", at: { file: 0, rank: 1 } },
    { id: "black-runner", typeId: "runner", ownerId: "black", at: { file: 2, rank: 3 } },
  ],
  objectives: [{
    type: "reach-target",
    requireAction: true,
    targets: [
      { playerId: "white", cells: [{ file: 0, rank: 2 }], eligiblePieceTypeIds: ["runner"] },
      { playerId: "black", cells: [{ file: 2, rank: 0 }, { file: 1, rank: 2 }], eligiblePieceTypeIds: ["runner"] },
    ],
  }],
} as const;

/** Guard a2→a3 (ineligible), Runner b1→b2→b3 (opposing target), Black Runner c4→c1 wins. */
export const crossroadsMoves: readonly (readonly [string, string])[] = [
  ["a2", "a3"],
  ["c4", "c3"],
  ["b1", "b2"],
  ["c3", "c2"],
  ["b2", "b3"],
  ["c2", "c1"],
];

/** The Long Walk: White's Runner reaches a3 on the third ply. */
export const longWalkMoves: readonly (readonly [string, string])[] = [
  ["a1", "a2"],
  ["c3", "c2"],
  ["a2", "a3"],
];

/**
 * Last Flock Standing: White's Chancellor takes the Nightrider, Camel and
 * Chancellor, then White's Nightrider takes Black's last piece, the Tower.
 */
export const lastFlockMoves: readonly (readonly [string, string])[] = [
  ["a1", "a5"],
  ["b5", "b4"],
  ["a5", "c5"],
  ["b4", "a4"],
  ["c5", "e5"],
  ["a4", "a3"],
  ["e1", "a3"],
];
