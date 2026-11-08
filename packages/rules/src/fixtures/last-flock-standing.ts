import { parseVariantDefinition } from "../parse";
import { createPieceTypeFromTemplate } from "../piece-templates";

export const lastFlockStandingVariantSource = {
  schemaVersion: 2,
  id: "last-flock-standing",
  name: "Last Flock Standing",
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
    createPieceTypeFromTemplate("tower", { id: "tower" }),
    createPieceTypeFromTemplate("chancellor", { id: "chancellor" }),
    createPieceTypeFromTemplate("camel", { id: "camel" }),
    createPieceTypeFromTemplate("nightrider", { id: "nightrider" }),
  ],
  setup: [
    { id: "white-chancellor", typeId: "chancellor", ownerId: "white", at: { file: 0, rank: 0 } },
    { id: "white-tower", typeId: "tower", ownerId: "white", at: { file: 1, rank: 0 } },
    { id: "white-camel", typeId: "camel", ownerId: "white", at: { file: 2, rank: 0 } },
    { id: "white-nightrider", typeId: "nightrider", ownerId: "white", at: { file: 4, rank: 0 } },
    { id: "black-nightrider", typeId: "nightrider", ownerId: "black", at: { file: 0, rank: 4 } },
    { id: "black-tower", typeId: "tower", ownerId: "black", at: { file: 1, rank: 4 } },
    { id: "black-camel", typeId: "camel", ownerId: "black", at: { file: 2, rank: 4 } },
    { id: "black-chancellor", typeId: "chancellor", ownerId: "black", at: { file: 4, rank: 4 } },
  ],
  objectives: [{ type: "eliminate-all" }],
} as const;

const parsedLastFlockStanding = parseVariantDefinition(lastFlockStandingVariantSource);

if (!parsedLastFlockStanding.ok) {
  throw new Error("The bundled Last Flock Standing variant must satisfy the current public variant schema.");
}

export const lastFlockStandingVariant = parsedLastFlockStanding.value;
export const lastFlockStandingVariantJson = JSON.stringify(lastFlockStandingVariant, null, 2);
