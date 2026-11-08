"use client";

import { useMemo } from "react";
import type { PieceTypeDefinition } from "@rookery/rules";
import { BoardSurface } from "@/components/board-surface";
import { previewTargets } from "./model";
import styles from "./piece-library.module.css";

export function MovementPreview({ type, forwardRank = 1, label, onChoose, compact = false }: {
  type: PieceTypeDefinition; forwardRank?: 1 | -1; label: string;
  onChoose?: (x: number, y: number) => void; compact?: boolean;
}) {
  const targets = useMemo(() => previewTargets(type, forwardRank), [type, forwardRank]);
  const board = <BoardSurface files={9} ranks={9} pieces={[{ id: "center", kind: type.id, side: forwardRank === 1 ? "white" : "black", square: "e5", label: type.name || "Your piece" }]}
    label={label} coordinates={!compact} selectedSquare="e5" legalDestinations={targets.moves} captureDestinations={targets.captures}
    renderPiece={() => <span className={styles.centerToken}>✦</span>}
    onSquareActivate={onChoose ? ({ square }) => onChoose(square.charCodeAt(0) - 97 - 4, Number(square.slice(1)) - 5) : undefined} />;
  return <div className={compact ? styles.diagram : styles.miniBoard} aria-hidden={compact || undefined} inert={compact || !onChoose ? true : undefined}>{board}</div>;
}
