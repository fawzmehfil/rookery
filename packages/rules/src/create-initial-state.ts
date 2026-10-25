import { variantDefinitionSchema } from "./schema";
import type {
  Coordinate,
  EngineError,
  EngineErrorDetail,
  EngineResult,
  GamePiece,
  GameState,
  VariantDefinition,
} from "./types";

export function createInitialState(variant: VariantDefinition): EngineResult<GameState> {
  const parsed = variantDefinitionSchema.safeParse(variant);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return invalidVariant("The variant does not satisfy the runtime schema.", {
      path: issue?.path.join(".") ?? "variant",
      issue: issue?.message ?? "Unknown schema error",
    });
  }

  const definition: VariantDefinition = parsed.data;
  const playerIds = definition.players.map(({ id }) => id);
  const duplicatePlayerId = findDuplicate(playerIds);

  if (duplicatePlayerId) {
    return invalidVariant("Player IDs must be unique.", { playerId: duplicatePlayerId });
  }

  if (new Set(definition.turnOrder).size !== definition.players.length || !sameMembers(definition.turnOrder, playerIds)) {
    return invalidVariant("Turn order must contain every player exactly once.", {
      turnOrder: definition.turnOrder.join(","),
    });
  }

  const pieceTypeIds = definition.pieceTypes.map(({ id }) => id);
  const duplicatePieceTypeId = findDuplicate(pieceTypeIds);

  if (duplicatePieceTypeId) {
    return invalidVariant("Piece type IDs must be unique.", { pieceTypeId: duplicatePieceTypeId });
  }

  const disabledCellKeys = definition.board.disabledCells.map(coordinateKey);
  const duplicateDisabledCell = findDuplicate(disabledCellKeys);

  for (const coordinate of definition.board.disabledCells) {
    if (!isOnBoard(coordinate, definition.board.files, definition.board.ranks)) {
      return invalidVariant("Disabled cells must be inside the board.", { coordinate: coordinateKey(coordinate) });
    }
  }

  if (duplicateDisabledCell) {
    return invalidVariant("Disabled cells must be unique.", { coordinate: duplicateDisabledCell });
  }

  const placementIds = definition.setup.map(({ id }) => id);
  const duplicatePlacementId = findDuplicate(placementIds);

  if (duplicatePlacementId) {
    return invalidVariant("Piece IDs must be unique.", { pieceId: duplicatePlacementId });
  }

  const occupiedCells = new Set<string>();
  const disabledCells = new Set(disabledCellKeys);

  for (const placement of definition.setup) {
    if (!pieceTypeIds.includes(placement.typeId)) {
      return invalidVariant("Every placed piece must reference a known piece type.", {
        pieceId: placement.id,
        pieceTypeId: placement.typeId,
      });
    }

    if (!playerIds.includes(placement.ownerId)) {
      return invalidVariant("Every placed piece must reference a known owner.", {
        pieceId: placement.id,
        ownerId: placement.ownerId,
      });
    }

    const cell = coordinateKey(placement.at);

    if (!isOnBoard(placement.at, definition.board.files, definition.board.ranks)) {
      return invalidVariant("Every placed piece must be inside the board.", {
        pieceId: placement.id,
        coordinate: cell,
      });
    }

    if (disabledCells.has(cell)) {
      return invalidVariant("A piece cannot start on a disabled cell.", {
        pieceId: placement.id,
        coordinate: cell,
      });
    }

    if (occupiedCells.has(cell)) {
      return invalidVariant("Only one piece may occupy a starting cell.", { coordinate: cell });
    }

    occupiedCells.add(cell);
  }

  const royalTypeIds = new Set(definition.pieceTypes.filter(({ royal }) => royal).map(({ id }) => id));

  for (const playerId of playerIds) {
    const royalCount = definition.setup.filter(
      ({ ownerId, typeId }) => ownerId === playerId && royalTypeIds.has(typeId),
    ).length;

    if (royalCount !== 1) {
      return invalidVariant("Capture-the-royal requires exactly one starting royal per player.", {
        playerId,
        royalCount,
      });
    }
  }

  const pieces = Object.freeze(
    definition.setup.map<GamePiece>((placement) =>
      Object.freeze({
        id: placement.id,
        typeId: placement.typeId,
        ownerId: placement.ownerId,
        at: freezeCoordinate(placement.at),
      }),
    ),
  );

  return {
    ok: true,
    value: Object.freeze({
      variantId: definition.id,
      ply: 0,
      activePlayerId: definition.turnOrder[0] ?? null,
      pieces,
      outcome: null,
    }),
  };
}

export function isOnBoard(coordinate: Coordinate, files: number, ranks: number): boolean {
  return (
    Number.isInteger(coordinate.file) &&
    Number.isInteger(coordinate.rank) &&
    coordinate.file >= 0 &&
    coordinate.file < files &&
    coordinate.rank >= 0 &&
    coordinate.rank < ranks
  );
}

export function coordinateKey(coordinate: Coordinate): string {
  return `${coordinate.file},${coordinate.rank}`;
}

export function freezeCoordinate(coordinate: Coordinate): Coordinate {
  return Object.freeze({ file: coordinate.file, rank: coordinate.rank });
}

function invalidVariant(message: string, details: Readonly<Record<string, EngineErrorDetail>>): EngineResult<never> {
  const error: EngineError = Object.freeze({
    code: "INVALID_VARIANT",
    message,
    details: Object.freeze({ ...details }),
  });

  return { ok: false, error };
}

function findDuplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }

  return null;
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  const rightMembers = new Set(right);
  return left.every((value) => rightMembers.has(value));
}
