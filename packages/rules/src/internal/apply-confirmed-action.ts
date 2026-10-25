import { coordinateKey, freezeCoordinate, isOnBoard } from "../create-initial-state";
import { evaluateOutcome } from "../evaluate-outcome";
import type {
  ApplyActionResult,
  EngineError,
  EngineErrorCode,
  EngineErrorDetail,
  EngineEvent,
  GamePiece,
  GameState,
  MoveAction,
  VariantDefinition,
} from "../types";

/**
 * Applies an action only after the movement engine has confirmed it is legal.
 * This function is internal so callers cannot bypass authoritative move checks.
 */
export function applyConfirmedAction(
  variant: VariantDefinition,
  state: GameState,
  action: MoveAction,
): ApplyActionResult {
  if (state.variantId !== variant.id) {
    return failure("INVALID_VARIANT", "The game state belongs to a different variant.", {
      expectedVariantId: variant.id,
      stateVariantId: state.variantId,
    });
  }

  if (state.outcome !== null || state.activePlayerId === null) {
    return failure("GAME_ALREADY_ENDED", "No actions are accepted after the game has ended.");
  }

  const movingPiece = state.pieces.find(({ id }) => id === action.pieceId);

  if (!movingPiece) {
    return failure("PIECE_NOT_FOUND", "The action references a piece that is not in the current position.", {
      pieceId: action.pieceId,
    });
  }

  if (movingPiece.ownerId !== state.activePlayerId) {
    return failure("NOT_ACTIVE_PLAYER", "The selected piece does not belong to the active player.", {
      pieceId: movingPiece.id,
      pieceOwnerId: movingPiece.ownerId,
      activePlayerId: state.activePlayerId,
    });
  }

  if (sameCoordinate(movingPiece.at, action.to)) {
    return failure("SAME_SQUARE", "A piece must move to a different cell.", {
      pieceId: movingPiece.id,
      coordinate: coordinateKey(action.to),
    });
  }

  if (!isOnBoard(action.to, variant.board.files, variant.board.ranks)) {
    return failure("DESTINATION_OUT_OF_BOUNDS", "The destination is outside the board.", {
      coordinate: coordinateKey(action.to),
    });
  }

  if (variant.board.disabledCells.some((coordinate) => sameCoordinate(coordinate, action.to))) {
    return failure("DESTINATION_DISABLED", "The destination is not an active board cell.", {
      coordinate: coordinateKey(action.to),
    });
  }

  const capturedPiece = state.pieces.find(({ at }) => sameCoordinate(at, action.to));

  if (capturedPiece?.ownerId === movingPiece.ownerId) {
    return failure("DESTINATION_OCCUPIED_BY_ALLY", "The destination contains a friendly piece.", {
      pieceId: movingPiece.id,
      occupyingPieceId: capturedPiece.id,
      coordinate: coordinateKey(action.to),
    });
  }

  const nextPlayerId = nextPlayer(variant, state.activePlayerId);

  if (!nextPlayerId) {
    return failure("INVALID_VARIANT", "The active player is missing from the variant turn order.", {
      activePlayerId: state.activePlayerId,
    });
  }

  const nextPly = state.ply + 1;
  const from = freezeCoordinate(movingPiece.at);
  const to = freezeCoordinate(action.to);
  const pieces = Object.freeze(
    state.pieces
      .filter(({ id }) => id !== capturedPiece?.id)
      .map<GamePiece>((piece) =>
        piece.id === movingPiece.id
          ? Object.freeze({ ...piece, at: to })
          : Object.freeze({ ...piece, at: freezeCoordinate(piece.at) }),
      ),
  );

  const events: EngineEvent[] = [
    Object.freeze({
      type: "piece-moved",
      ply: nextPly,
      pieceId: movingPiece.id,
      ownerId: movingPiece.ownerId,
      from,
      to,
    }),
  ];

  if (capturedPiece) {
    events.push(
      Object.freeze({
        type: "piece-captured",
        ply: nextPly,
        piece: freezePiece(capturedPiece),
        byPieceId: movingPiece.id,
        at: to,
      }),
    );
  }

  const positionAfterMove: GameState = {
    variantId: state.variantId,
    ply: nextPly,
    activePlayerId: nextPlayerId,
    pieces,
    outcome: null,
  };
  const outcome = evaluateOutcome(variant, positionAfterMove);

  if (outcome) {
    events.push(Object.freeze({ type: "game-ended", ply: nextPly, outcome }));
  } else {
    events.push(
      Object.freeze({
        type: "turn-changed",
        ply: nextPly,
        fromPlayerId: state.activePlayerId,
        toPlayerId: nextPlayerId,
      }),
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      state: Object.freeze({
        variantId: state.variantId,
        ply: nextPly,
        activePlayerId: outcome ? null : nextPlayerId,
        pieces,
        outcome,
      }),
      events: Object.freeze(events),
    }),
  };
}

function failure(
  code: EngineErrorCode,
  message: string,
  details?: Readonly<Record<string, EngineErrorDetail>>,
): ApplyActionResult {
  const error: EngineError = Object.freeze({
    code,
    message,
    ...(details ? { details: Object.freeze({ ...details }) } : {}),
  });

  return { ok: false, error };
}

function nextPlayer(variant: VariantDefinition, activePlayerId: string): string | null {
  const activeIndex = variant.turnOrder.indexOf(activePlayerId);

  if (activeIndex < 0) return null;

  return variant.turnOrder[(activeIndex + 1) % variant.turnOrder.length] ?? null;
}

function sameCoordinate(left: { readonly file: number; readonly rank: number }, right: { readonly file: number; readonly rank: number }) {
  return left.file === right.file && left.rank === right.rank;
}

function freezePiece(piece: GamePiece): GamePiece {
  return Object.freeze({ ...piece, at: freezeCoordinate(piece.at) });
}
