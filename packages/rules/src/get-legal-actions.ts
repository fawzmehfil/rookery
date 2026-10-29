import { coordinateKey, freezeCoordinate, isOnBoard } from "./create-initial-state";
import type {
  Coordinate,
  GamePiece,
  GameState,
  MoveAction,
  MovementFrame,
  MovementMode,
  MovementPattern,
  PlayerDefinition,
  VariantDefinition,
  Vector,
} from "./types";

type Occupancy = ReadonlyMap<string, GamePiece>;

/**
 * Lists every movement-legal action for the active player.
 *
 * Order is stable: pieces in state order, then each piece type's movement
 * patterns in definition order, then offsets or directions in definition
 * order, then increasing slide distance. A destination reached by more than
 * one pattern keeps its first position. Finished games and states for another
 * variant have no legal actions.
 */
export function getLegalActions(variant: VariantDefinition, state: GameState): readonly MoveAction[] {
  if (state.variantId !== variant.id || state.outcome !== null || state.activePlayerId === null) {
    return Object.freeze([]);
  }

  const activePlayer = variant.players.find(({ id }) => id === state.activePlayerId);

  if (!activePlayer) return Object.freeze([]);

  const disabledCells = new Set(variant.board.disabledCells.map(coordinateKey));
  const occupancy: Occupancy = new Map(state.pieces.map((piece) => [coordinateKey(piece.at), piece]));
  const isActiveCell = (coordinate: Coordinate) =>
    isOnBoard(coordinate, variant.board.files, variant.board.ranks) && !disabledCells.has(coordinateKey(coordinate));
  const actions: MoveAction[] = [];

  for (const piece of state.pieces) {
    if (piece.ownerId !== activePlayer.id) continue;

    // Unknown piece types are excluded by createInitialState; see the package README.
    const pieceType = variant.pieceTypes.find(({ id }) => id === piece.typeId);

    if (!pieceType) continue;

    const seenDestinations = new Set<string>();

    for (const movement of pieceType.movements) {
      for (const to of destinationsFor(piece, movement, activePlayer, occupancy, isActiveCell)) {
        const key = coordinateKey(to);

        if (seenDestinations.has(key)) continue;

        seenDestinations.add(key);
        actions.push(Object.freeze({ type: "move", pieceId: piece.id, to: freezeCoordinate(to) }));
      }
    }
  }

  return Object.freeze(actions);
}

function destinationsFor(
  piece: GamePiece,
  movement: MovementPattern,
  owner: PlayerDefinition,
  occupancy: Occupancy,
  isActiveCell: (coordinate: Coordinate) => boolean,
): Coordinate[] {
  const destinations: Coordinate[] = [];

  if (movement.kind === "slide") {
    const maxDistance = movement.maxDistance ?? Number.POSITIVE_INFINITY;

    for (const direction of movement.directions) {
      const vector = toBoardVector(direction, movement.frame, owner);

      for (let distance = 1; distance <= maxDistance; distance += 1) {
        const to = translate(piece.at, vector, distance);

        if (!isActiveCell(to)) break;

        const occupant = occupancy.get(coordinateKey(to));

        if (canLand(movement.mode, piece, occupant)) destinations.push(to);
        if (occupant) break;
      }
    }

    return destinations;
  }

  // Steps and leaps land directly on their offset, so intervening cells never matter.
  for (const offset of movement.offsets) {
    const to = translate(piece.at, toBoardVector(offset, movement.frame, owner), 1);

    if (isActiveCell(to) && canLand(movement.mode, piece, occupancy.get(coordinateKey(to)))) {
      destinations.push(to);
    }
  }

  return destinations;
}

/**
 * Owner-relative vectors are written from the owner's side of the board.
 * Forward and backward follow `forwardRank`; left and right are unchanged.
 */
function toBoardVector(vector: Vector, frame: MovementFrame, owner: PlayerDefinition): Vector {
  if (frame === "board") return vector;

  return { fileDelta: vector.fileDelta, rankDelta: vector.rankDelta * owner.forwardRank };
}

function translate(from: Coordinate, vector: Vector, distance: number): Coordinate {
  return { file: from.file + vector.fileDelta * distance, rank: from.rank + vector.rankDelta * distance };
}

function canLand(mode: MovementMode, piece: GamePiece, occupant: GamePiece | undefined): boolean {
  if (!occupant) return mode !== "capture-only";
  if (occupant.ownerId === piece.ownerId) return false;
  return mode !== "move-only";
}
