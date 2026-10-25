import { parseVariantDefinition } from "../parse";
import type { MoveAction } from "../types";

const adjacentOffsets = [
  { fileDelta: -1, rankDelta: -1 },
  { fileDelta: 0, rankDelta: -1 },
  { fileDelta: 1, rankDelta: -1 },
  { fileDelta: -1, rankDelta: 0 },
  { fileDelta: 1, rankDelta: 0 },
  { fileDelta: -1, rankDelta: 1 },
  { fileDelta: 0, rankDelta: 1 },
  { fileDelta: 1, rankDelta: 1 },
] as const;

const orthogonalDirections = [
  { fileDelta: -1, rankDelta: 0 },
  { fileDelta: 1, rankDelta: 0 },
  { fileDelta: 0, rankDelta: -1 },
  { fileDelta: 0, rankDelta: 1 },
] as const;

const leaperOffsets = [
  { fileDelta: -2, rankDelta: -1 },
  { fileDelta: -2, rankDelta: 1 },
  { fileDelta: -1, rankDelta: -2 },
  { fileDelta: -1, rankDelta: 2 },
  { fileDelta: 1, rankDelta: -2 },
  { fileDelta: 1, rankDelta: 2 },
  { fileDelta: 2, rankDelta: -1 },
  { fileDelta: 2, rankDelta: 1 },
] as const;

export const firstFlightVariantSource = {
  schemaVersion: 1,
  id: "first-flight",
  name: "First Flight",
  board: {
    files: 5,
    ranks: 5,
    disabledCells: [],
  },
  players: [
    { id: "white", name: "White", forwardRank: 1 },
    { id: "black", name: "Black", forwardRank: -1 },
  ],
  turnOrder: ["white", "black"],
  pieceTypes: [
    {
      id: "sovereign",
      name: "Sovereign",
      royal: true,
      movements: [
        {
          kind: "step",
          frame: "board",
          mode: "move-or-capture",
          offsets: adjacentOffsets,
        },
      ],
    },
    {
      id: "tower",
      name: "Tower",
      royal: false,
      movements: [
        {
          kind: "slide",
          frame: "board",
          mode: "move-or-capture",
          directions: orthogonalDirections,
        },
      ],
    },
    {
      id: "hopper",
      name: "Hopper",
      royal: false,
      movements: [
        {
          kind: "leap",
          frame: "board",
          mode: "move-or-capture",
          offsets: leaperOffsets,
        },
      ],
    },
  ],
  setup: [
    { id: "white-tower", typeId: "tower", ownerId: "white", at: { file: 0, rank: 0 } },
    { id: "white-sovereign", typeId: "sovereign", ownerId: "white", at: { file: 2, rank: 0 } },
    { id: "white-hopper", typeId: "hopper", ownerId: "white", at: { file: 4, rank: 0 } },
    { id: "black-hopper", typeId: "hopper", ownerId: "black", at: { file: 0, rank: 4 } },
    { id: "black-sovereign", typeId: "sovereign", ownerId: "black", at: { file: 2, rank: 4 } },
    { id: "black-tower", typeId: "tower", ownerId: "black", at: { file: 4, rank: 4 } },
  ],
  objectives: [{ type: "capture-royal" }],
} as const;

const parsedFirstFlight = parseVariantDefinition(firstFlightVariantSource);

if (!parsedFirstFlight.ok) {
  throw new Error("The bundled First Flight variant must satisfy the public variant schema.");
}

export const firstFlightVariant = parsedFirstFlight.value;
export const firstFlightVariantJson = JSON.stringify(firstFlightVariant, null, 2);

/**
 * A legal demonstration for the completed movement engine. It exercises a
 * slide, leap, royal step, ordinary captures, and capture-the-royal victory.
 */
export const firstFlightDemonstration = [
  { type: "move", pieceId: "white-tower", to: { file: 0, rank: 3 } },
  { type: "move", pieceId: "black-hopper", to: { file: 1, rank: 2 } },
  { type: "move", pieceId: "white-sovereign", to: { file: 1, rank: 1 } },
  { type: "move", pieceId: "black-sovereign", to: { file: 1, rank: 4 } },
  { type: "move", pieceId: "white-tower", to: { file: 1, rank: 3 } },
  { type: "move", pieceId: "black-tower", to: { file: 4, rank: 1 } },
  { type: "move", pieceId: "white-tower", to: { file: 1, rank: 2 } },
  { type: "move", pieceId: "black-tower", to: { file: 4, rank: 0 } },
  { type: "move", pieceId: "white-tower", to: { file: 1, rank: 4 } },
] as const satisfies readonly MoveAction[];
