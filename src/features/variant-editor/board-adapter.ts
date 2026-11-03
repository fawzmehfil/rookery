import { coordinateToSquare, type VariantDefinition } from "@rookery/rules";
import type { BoardPiece } from "@/components/board-surface";

export function editorBoardPieces(variant: VariantDefinition): BoardPiece[] {
  return variant.setup.map(p => {
    const type = variant.pieceTypes.find(t => t.id === p.typeId);
    const player = variant.players.find(player => player.id === p.ownerId);
    return { id: p.id, square: coordinateToSquare(p.at),
      kind: ({ sovereign: "king", tower: "rook", hopper: "knight" } as Record<string, string>)[p.typeId] ?? p.typeId,
      side: p.ownerId === variant.players[0]?.id ? "white" : "black",
      label: `${player?.name ?? p.ownerId} ${type?.name ?? p.typeId}` };
  });
}
