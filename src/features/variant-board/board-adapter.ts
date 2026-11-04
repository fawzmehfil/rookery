import {
  coordinateToSquare,
  type GamePiece,
  type PiecePlacement,
  type VariantDefinition,
} from "@rookery/rules";
import type { BoardPiece } from "@/components/board-surface";

/** Maps shared engine/editor pieces into the single accessible board view. */
export function variantBoardPieces(
  variant: VariantDefinition,
  pieces: readonly (GamePiece | PiecePlacement)[],
): BoardPiece[] {
  return pieces.map((piece) => {
    const type = variant.pieceTypes.find(({ id }) => id === piece.typeId);
    const player = variant.players.find(({ id }) => id === piece.ownerId);

    return {
      id: piece.id,
      square: coordinateToSquare(piece.at),
      kind: ({ sovereign: "king", tower: "rook", hopper: "knight" } as Record<string, string>)[piece.typeId] ?? piece.typeId,
      side: piece.ownerId === variant.players[0]?.id ? "white" : "black",
      label: `${player?.name ?? piece.ownerId} ${type?.name ?? piece.typeId}`,
    };
  });
}
