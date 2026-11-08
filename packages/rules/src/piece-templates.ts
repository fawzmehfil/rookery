import { pieceTypeDefinitionSchema } from "./schema";
import type { MovementPattern, PieceTypeDefinition, Vector } from "./types";

export type PieceTemplateCategory = "standard" | "compound" | "leaper" | "rider" | "additional-classic";

export type PieceTemplateTag =
  | "standard"
  | "slider"
  | "leaper"
  | "compound"
  | "rider"
  | "owner-relative"
  | "royal-capable"
  | "recommended"
  | "additional-classic";

type PieceTemplateSource = Readonly<{
  id: string;
  name: string;
  aliases: readonly string[];
  description: string;
  category: PieceTemplateCategory;
  tags: readonly PieceTemplateTag[];
  defaultToken: string;
  defaultRoyal: boolean;
  movements: readonly MovementPattern[];
}>;

const orthogonalVectors = orientedVectors(1, 0);
const diagonalVectors = orientedVectors(1, 1);
const adjacentVectors = mergeVectors(orthogonalVectors, diagonalVectors);
const knightVectors = orientedVectors(1, 2);

const pieceTemplateSources = [
  {
    id: "sovereign",
    name: "Sovereign",
    aliases: ["King"],
    description: "Steps one cell in any direction.",
    category: "standard",
    tags: ["standard", "royal-capable"],
    defaultToken: "K",
    defaultRoyal: true,
    movements: [step(adjacentVectors)],
  },
  {
    id: "tower",
    name: "Tower",
    aliases: ["Rook"],
    description: "Slides any distance horizontally or vertically.",
    category: "standard",
    tags: ["standard", "slider"],
    defaultToken: "R",
    defaultRoyal: false,
    movements: [slide(orthogonalVectors)],
  },
  {
    id: "bishop",
    name: "Bishop",
    aliases: [],
    description: "Slides any distance diagonally.",
    category: "standard",
    tags: ["standard", "slider"],
    defaultToken: "B",
    defaultRoyal: false,
    movements: [slide(diagonalVectors)],
  },
  {
    id: "queen",
    name: "Queen",
    aliases: [],
    description: "Slides any distance horizontally, vertically, or diagonally.",
    category: "standard",
    tags: ["standard", "slider"],
    defaultToken: "Q",
    defaultRoyal: false,
    movements: [slide(adjacentVectors)],
  },
  {
    id: "hopper",
    name: "Hopper",
    aliases: ["Knight"],
    description: "Leaps in an L-shape: two cells on one axis and one on the other.",
    category: "standard",
    tags: ["standard", "leaper"],
    defaultToken: "N",
    defaultRoyal: false,
    movements: [leap(knightVectors)],
  },
  {
    id: "pawn",
    name: "Pawn",
    aliases: [],
    description: "Steps one cell forward into an empty cell and captures one cell diagonally forward.",
    category: "standard",
    tags: ["standard", "owner-relative"],
    defaultToken: "P",
    defaultRoyal: false,
    movements: [
      step([{ fileDelta: 0, rankDelta: 1 }], "owner", "move-only"),
      step(
        [
          { fileDelta: -1, rankDelta: 1 },
          { fileDelta: 1, rankDelta: 1 },
        ],
        "owner",
        "capture-only",
      ),
    ],
  },
  {
    id: "chancellor",
    name: "Chancellor",
    aliases: ["Empress", "Marshal"],
    description: "Combines a rook's sliding movement with a knight's leap.",
    category: "compound",
    tags: ["compound", "slider", "leaper", "recommended"],
    defaultToken: "C",
    defaultRoyal: false,
    movements: [slide(orthogonalVectors), leap(knightVectors)],
  },
  {
    id: "archbishop",
    name: "Archbishop",
    aliases: ["Cardinal", "Princess"],
    description: "Combines a bishop's sliding movement with a knight's leap.",
    category: "compound",
    tags: ["compound", "slider", "leaper", "recommended"],
    defaultToken: "A",
    defaultRoyal: false,
    movements: [slide(diagonalVectors), leap(knightVectors)],
  },
  {
    id: "amazon",
    name: "Amazon",
    aliases: [],
    description: "Combines a queen's sliding movement with a knight's leap.",
    category: "compound",
    tags: ["compound", "slider", "leaper", "recommended"],
    defaultToken: "Am",
    defaultRoyal: false,
    movements: [slide(adjacentVectors), leap(knightVectors)],
  },
  {
    id: "centaur",
    name: "Centaur",
    aliases: ["General"],
    description: "Combines a one-cell step in any direction with a knight's leap.",
    category: "compound",
    tags: ["compound", "leaper", "royal-capable"],
    defaultToken: "Ct",
    defaultRoyal: false,
    movements: [step(adjacentVectors), leap(knightVectors)],
  },
  {
    id: "wazir",
    name: "Wazir",
    aliases: [],
    description: "Steps exactly one cell horizontally or vertically.",
    category: "additional-classic",
    tags: ["additional-classic"],
    defaultToken: "W",
    defaultRoyal: false,
    movements: [step(orthogonalVectors)],
  },
  {
    id: "ferz",
    name: "Ferz",
    aliases: [],
    description: "Steps exactly one cell diagonally.",
    category: "additional-classic",
    tags: ["additional-classic"],
    defaultToken: "F",
    defaultRoyal: false,
    movements: [step(diagonalVectors)],
  },
  {
    id: "alfil",
    name: "Alfil",
    aliases: [],
    description: "Leaps exactly two cells diagonally, ignoring the intervening cell.",
    category: "additional-classic",
    tags: ["additional-classic", "leaper"],
    defaultToken: "Al",
    defaultRoyal: false,
    movements: [leap(orientedVectors(2, 2))],
  },
  {
    id: "dabbaba",
    name: "Dabbaba",
    aliases: [],
    description: "Leaps exactly two cells horizontally or vertically, ignoring the intervening cell.",
    category: "additional-classic",
    tags: ["additional-classic", "leaper"],
    defaultToken: "D",
    defaultRoyal: false,
    movements: [leap(orientedVectors(2, 0))],
  },
  {
    id: "camel",
    name: "Camel",
    aliases: [],
    description: "Leaps three cells on one axis and one on the other.",
    category: "leaper",
    tags: ["leaper", "recommended"],
    defaultToken: "Ca",
    defaultRoyal: false,
    movements: [leap(orientedVectors(3, 1))],
  },
  {
    id: "zebra",
    name: "Zebra",
    aliases: [],
    description: "Leaps three cells on one axis and two on the other.",
    category: "leaper",
    tags: ["leaper", "recommended"],
    defaultToken: "Z",
    defaultRoyal: false,
    movements: [leap(orientedVectors(3, 2))],
  },
  {
    id: "nightrider",
    name: "Nightrider",
    aliases: [],
    description: "Repeats one knight vector as a sliding ray without turning.",
    category: "rider",
    tags: ["rider", "slider", "recommended"],
    defaultToken: "Nr",
    defaultRoyal: false,
    movements: [slide(knightVectors)],
  },
] as const satisfies readonly PieceTemplateSource[];

export type PieceTemplateId = (typeof pieceTemplateSources)[number]["id"];

export type PieceTemplate = Omit<PieceTemplateSource, "id"> & Readonly<{ id: PieceTemplateId }>;

export const pieceTemplateCatalog: readonly PieceTemplate[] = Object.freeze(
  pieceTemplateSources.map(freezeTemplate),
);

export function getPieceTemplate(templateId: string): PieceTemplate | undefined {
  return pieceTemplateCatalog.find(({ id }) => id === templateId);
}

export function createPieceTypeFromTemplate(
  templateId: PieceTemplateId,
  options: Readonly<{ id: string; name?: string; royal?: boolean }>,
): PieceTypeDefinition {
  const template = getPieceTemplate(templateId);

  if (!template) throw new RangeError(`Unknown piece template: ${templateId}`);

  return freezePieceType(
    pieceTypeDefinitionSchema.parse({
      id: options.id,
      name: options.name ?? template.name,
      royal: options.royal ?? template.defaultRoyal,
      movements: template.movements,
    }),
  );
}

function orientedVectors(first: number, second: number): readonly Vector[] {
  const vectors = new Map<string, Vector>();
  const axes = first === second ? [[first, second]] : [[first, second], [second, first]];

  for (const [fileMagnitude = 0, rankMagnitude = 0] of axes) {
    for (const fileSign of [-1, 1]) {
      for (const rankSign of [-1, 1]) {
        const vector = {
          fileDelta: fileMagnitude * fileSign,
          rankDelta: rankMagnitude * rankSign,
        };
        vectors.set(`${vector.fileDelta},${vector.rankDelta}`, vector);
      }
    }
  }

  return Object.freeze(
    [...vectors.values()]
      .sort((left, right) => left.fileDelta - right.fileDelta || left.rankDelta - right.rankDelta)
      .map((vector) => Object.freeze(vector)),
  );
}

function mergeVectors(...groups: readonly (readonly Vector[])[]): readonly Vector[] {
  const vectors = new Map<string, Vector>();

  for (const vector of groups.flat()) {
    vectors.set(`${vector.fileDelta},${vector.rankDelta}`, vector);
  }

  return Object.freeze(
    [...vectors.values()]
      .sort((left, right) => left.fileDelta - right.fileDelta || left.rankDelta - right.rankDelta)
      .map((vector) => Object.freeze({ ...vector })),
  );
}

function step(
  offsets: readonly Vector[],
  frame: "board" | "owner" = "board",
  mode: "move-only" | "capture-only" | "move-or-capture" = "move-or-capture",
): MovementPattern {
  return { kind: "step", frame, mode, offsets };
}

function leap(offsets: readonly Vector[]): MovementPattern {
  return { kind: "leap", frame: "board", mode: "move-or-capture", offsets };
}

function slide(directions: readonly Vector[]): MovementPattern {
  return { kind: "slide", frame: "board", mode: "move-or-capture", directions };
}

function freezeTemplate(source: (typeof pieceTemplateSources)[number]): PieceTemplate {
  const parsed = pieceTypeDefinitionSchema.parse({
    id: source.id,
    name: source.name,
    royal: source.defaultRoyal,
    movements: source.movements,
  });

  return Object.freeze({
    ...source,
    aliases: Object.freeze([...source.aliases]),
    tags: Object.freeze([...source.tags]),
    movements: freezeMovements(parsed.movements),
  });
}

function freezePieceType(pieceType: PieceTypeDefinition): PieceTypeDefinition {
  return Object.freeze({
    ...pieceType,
    movements: freezeMovements(pieceType.movements),
  });
}

function freezeMovements(movements: readonly MovementPattern[]): readonly MovementPattern[] {
  return Object.freeze(
    movements.map((movement) => {
      if (movement.kind === "slide") {
        return Object.freeze({
          ...movement,
          directions: Object.freeze(movement.directions.map((direction) => Object.freeze({ ...direction }))),
        });
      }

      return Object.freeze({
        ...movement,
        offsets: Object.freeze(movement.offsets.map((offset) => Object.freeze({ ...offset }))),
      });
    }),
  );
}
