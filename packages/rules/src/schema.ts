import { z } from "zod";

const MAX_BOARD_AXIS = 26;
const MAX_PIECE_TYPES = 128;
const MAX_BOARD_CELLS = MAX_BOARD_AXIS * MAX_BOARD_AXIS;

export const identifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens, starting with a letter.");

export const coordinateSchema = z
  .object({
    file: z.int().min(0).max(MAX_BOARD_AXIS - 1),
    rank: z.int().min(0).max(MAX_BOARD_AXIS - 1),
  })
  .strict();

export const vectorSchema = z
  .object({
    fileDelta: z.int().min(-MAX_BOARD_AXIS + 1).max(MAX_BOARD_AXIS - 1),
    rankDelta: z.int().min(-MAX_BOARD_AXIS + 1).max(MAX_BOARD_AXIS - 1),
  })
  .strict()
  .refine(({ fileDelta, rankDelta }) => fileDelta !== 0 || rankDelta !== 0, {
    message: "A movement vector cannot be zero.",
  });

const stepOffsetSchema = vectorSchema.refine(
  ({ fileDelta, rankDelta }) => Math.max(Math.abs(fileDelta), Math.abs(rankDelta)) === 1,
  { message: "A step offset must reach an adjacent cell." },
);

const slideDirectionSchema = vectorSchema.refine(
  ({ fileDelta, rankDelta }) => greatestCommonDivisor(Math.abs(fileDelta), Math.abs(rankDelta)) === 1,
  { message: "A slide direction must be a primitive vector." },
);

export const movementFrameSchema = z.enum(["board", "owner"]);
export const movementModeSchema = z.enum(["move-only", "capture-only", "move-or-capture"]);

const movementFields = {
  frame: movementFrameSchema,
  mode: movementModeSchema,
};

export const stepMovementSchema = z
  .object({
    kind: z.literal("step"),
    ...movementFields,
    offsets: z.array(stepOffsetSchema).min(1).max(8),
  })
  .strict();

export const leapMovementSchema = z
  .object({
    kind: z.literal("leap"),
    ...movementFields,
    offsets: z.array(vectorSchema).min(1).max(64),
  })
  .strict();

export const slideMovementSchema = z
  .object({
    kind: z.literal("slide"),
    ...movementFields,
    directions: z.array(slideDirectionSchema).min(1).max(16),
    maxDistance: z.int().min(1).max(MAX_BOARD_AXIS - 1).optional(),
  })
  .strict();

export const movementPatternSchema = z.discriminatedUnion("kind", [
  stepMovementSchema,
  leapMovementSchema,
  slideMovementSchema,
]);

export const boardDefinitionSchema = z
  .object({
    files: z.int().min(1).max(MAX_BOARD_AXIS),
    ranks: z.int().min(1).max(MAX_BOARD_AXIS),
    disabledCells: z.array(coordinateSchema).max(MAX_BOARD_CELLS).default([]),
  })
  .strict();

export const playerDefinitionSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(80),
    forwardRank: z.union([z.literal(-1), z.literal(1)]),
  })
  .strict();

export const pieceTypeDefinitionSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(80),
    royal: z.boolean().default(false),
    movements: z.array(movementPatternSchema).min(1).max(64),
  })
  .strict();

export const piecePlacementSchema = z
  .object({
    id: identifierSchema,
    typeId: identifierSchema,
    ownerId: identifierSchema,
    at: coordinateSchema,
  })
  .strict();

export const captureRoyalObjectiveSchema = z.object({ type: z.literal("capture-royal") }).strict();

export const variantDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: identifierSchema,
    name: z.string().trim().min(1).max(120),
    board: boardDefinitionSchema,
    players: z.array(playerDefinitionSchema).length(2),
    turnOrder: z.array(identifierSchema).length(2),
    pieceTypes: z.array(pieceTypeDefinitionSchema).min(1).max(MAX_PIECE_TYPES),
    setup: z.array(piecePlacementSchema).min(1).max(MAX_BOARD_CELLS),
    objectives: z.array(captureRoyalObjectiveSchema).length(1),
  })
  .strict();

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;

  while (b !== 0) {
    [a, b] = [b, a % b];
  }

  return a;
}
