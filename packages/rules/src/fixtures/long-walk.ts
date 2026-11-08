import { parseVariantDefinition } from "../parse";

export const longWalkVariantSource = {
  schemaVersion: 2,
  id: "the-long-walk",
  name: "The Long Walk",
  board: {
    files: 3,
    ranks: 3,
    disabledCells: [],
  },
  players: [
    { id: "white", name: "White", forwardRank: 1 },
    { id: "black", name: "Black", forwardRank: -1 },
  ],
  turnOrder: ["white", "black"],
  pieceTypes: [
    {
      id: "runner",
      name: "Runner",
      royal: false,
      movements: [
        {
          kind: "step",
          frame: "owner",
          mode: "move-or-capture",
          offsets: [{ fileDelta: 0, rankDelta: 1 }],
        },
      ],
    },
  ],
  setup: [
    { id: "white-runner", typeId: "runner", ownerId: "white", at: { file: 0, rank: 0 } },
    { id: "black-runner", typeId: "runner", ownerId: "black", at: { file: 2, rank: 2 } },
  ],
  objectives: [
    {
      type: "reach-target",
      requireAction: true,
      targets: [
        { playerId: "white", cells: [{ file: 0, rank: 2 }], eligiblePieceTypeIds: ["runner"] },
        { playerId: "black", cells: [{ file: 2, rank: 0 }], eligiblePieceTypeIds: ["runner"] },
      ],
    },
  ],
} as const;

const parsedLongWalk = parseVariantDefinition(longWalkVariantSource);

if (!parsedLongWalk.ok) {
  throw new Error("The bundled Long Walk variant must satisfy the current public variant schema.");
}

export const longWalkVariant = parsedLongWalk.value;
export const longWalkVariantJson = JSON.stringify(longWalkVariant, null, 2);
