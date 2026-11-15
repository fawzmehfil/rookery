import {
  coordinateToSquare,
  type EngineEvent,
  type GameOutcome,
  type GamePiece,
  type GameState,
  type ObjectiveDefinition,
  type VariantDefinition,
} from "@rookery/rules";
import type { BoardSide, BoardTarget } from "@/components/board-surface";

/*
 * Display text for objectives, targets, progress and outcomes. Everything here
 * formats variant configuration or engine output; victory, captures, turns and
 * legality always come from the engine.
 */

export type ObjectiveSummary = Readonly<{
  type: ObjectiveDefinition["type"];
  title: string;
  instructions: string;
}>;

export type PlayerTargetSummary = Readonly<{
  playerId: string;
  playerName: string;
  side: BoardSide;
  squares: readonly string[];
  /** "Any piece", or the eligible piece type names. */
  eligibility: string;
}>;

export type RemainingPieces = Readonly<{
  playerId: string;
  playerName: string;
  count: number;
}>;

export type OutcomePresentation = Readonly<{
  headline: string;
  detail: string;
}>;

const INSTRUCTIONS: Record<ObjectiveDefinition["type"], Omit<ObjectiveSummary, "type">> = {
  "capture-royal": {
    title: "Capture the royal",
    instructions: "Win by capturing your opponent's royal piece.",
  },
  "reach-target": {
    title: "Reach a target",
    instructions: "Win by moving an eligible piece onto one of your own target cells; starting on one does not count.",
  },
  "eliminate-all": {
    title: "Eliminate all opponents",
    instructions: "Win by capturing your opponent's last remaining piece.",
  },
};

export function objectiveSummary(variant: VariantDefinition): ObjectiveSummary | null {
  const objective = variant.objectives[0];
  return objective ? { type: objective.type, ...INSTRUCTIONS[objective.type] } : null;
}

/** Configured targets per player, in player order. Empty unless the objective is reach-target. */
export function playerTargets(variant: VariantDefinition): PlayerTargetSummary[] {
  const objective = variant.objectives[0];
  if (objective?.type !== "reach-target") return [];

  return variant.players.flatMap((player) => {
    const target = objective.targets.find(({ playerId }) => playerId === player.id);
    if (!target) return [];

    return [{
      playerId: player.id,
      playerName: player.name,
      side: playerSide(variant, player.id),
      squares: target.cells.map(coordinateToSquare),
      eligibility: target.eligiblePieceTypeIds
        ? target.eligiblePieceTypeIds.map((id) => typeName(variant, id)).join(", ")
        : "Any piece",
    }];
  });
}

/**
 * Board markers for every configured target. When a piece is selected, each
 * label says whether that piece's owner and type match the target's
 * configuration. It never claims a move wins; only the engine outcome does.
 */
export function boardTargets(variant: VariantDefinition, selectedPiece: GamePiece | null): BoardTarget[] {
  const objective = variant.objectives[0];
  if (objective?.type !== "reach-target") return [];

  return objective.targets.flatMap((target) => {
    const owner = playerName(variant, target.playerId);
    let label = `${owner} target`;

    if (selectedPiece) {
      const configured = selectedPiece.ownerId === target.playerId
        && (!target.eligiblePieceTypeIds || target.eligiblePieceTypeIds.includes(selectedPiece.typeId));
      label += configured ? ", selected piece eligible" : ", selected piece not eligible";
    }

    return target.cells.map((cell) => ({
      square: coordinateToSquare(cell),
      side: playerSide(variant, target.playerId),
      label,
    }));
  });
}

/** Pieces each player still has in the given (engine-produced) state. */
export function remainingPieces(variant: VariantDefinition, state: GameState): RemainingPieces[] {
  return variant.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    count: state.pieces.filter(({ ownerId }) => ownerId === player.id).length,
  }));
}

/** Terminal status text built only from the structured engine outcome. */
export function describeOutcome(outcome: GameOutcome, variant: VariantDefinition): OutcomePresentation {
  const headline = `${playerName(variant, outcome.winnerPlayerId)} wins`;

  switch (outcome.reason) {
    case "capture-royal":
      return {
        headline,
        detail: `Victory by capturing the opposing royal: ${pieceName(variant, outcome.capturedPieceId)}.`,
      };
    case "reach-target":
      return {
        headline,
        detail: `Victory by reaching a target: ${pieceName(variant, outcome.pieceId)} reached ${coordinateToSquare(outcome.target)}.`,
      };
    case "eliminate-all":
      return {
        headline,
        detail: `Victory by elimination: ${pieceName(variant, outcome.capturedPieceId)} was ${playerName(variant, outcome.loserPlayerId)}'s last piece.`,
      };
    default: {
      const unhandled: never = outcome;
      return { headline, detail: `Victory: ${(unhandled as GameOutcome).reason}.` };
    }
  }
}

/** One event-log line. Game-ended lines name the objective's trigger. */
export function describeEvent(event: EngineEvent, variant: VariantDefinition): string {
  switch (event.type) {
    case "piece-moved":
      return `${pieceName(variant, event.pieceId)} moved ${coordinateToSquare(event.from)} to ${coordinateToSquare(event.to)}.`;
    case "piece-captured":
      return `${pieceName(variant, event.piece.id)} was captured on ${coordinateToSquare(event.at)}.`;
    case "turn-changed":
      return `Turn changed to ${playerName(variant, event.toPlayerId)}.`;
    case "game-ended":
      return endedLine(event.outcome, variant);
  }
}

/**
 * The single live-region sentence for one accepted action: the move, any
 * capture, then either the result or whose turn it is.
 */
export function announceAcceptedAction(events: readonly EngineEvent[], variant: VariantDefinition): string {
  const parts: string[] = [];
  const moved = events.find((event) => event.type === "piece-moved");
  const captured = events.find((event) => event.type === "piece-captured");
  const ended = events.find((event) => event.type === "game-ended");
  const turn = events.find((event) => event.type === "turn-changed");

  if (moved?.type === "piece-moved") {
    const capture = captured?.type === "piece-captured" ? `, capturing ${pieceName(variant, captured.piece.id)}` : "";
    parts.push(`${pieceName(variant, moved.pieceId)} moved ${coordinateToSquare(moved.from)} to ${coordinateToSquare(moved.to)}${capture}.`);
  }

  if (ended?.type === "game-ended") parts.push(endedLine(ended.outcome, variant));
  else if (turn?.type === "turn-changed") parts.push(`${playerName(variant, turn.toPlayerId)} to move.`);

  return parts.join(" ");
}

/** Display name for a piece by its stable setup ID, e.g. "White Runner". */
export function pieceName(variant: VariantDefinition, pieceId: string): string {
  const piece = variant.setup.find(({ id }) => id === pieceId);
  if (!piece) return pieceId;
  return `${playerName(variant, piece.ownerId)} ${typeName(variant, piece.typeId)}`;
}

export function playerName(variant: VariantDefinition, playerId: string): string {
  return variant.players.find(({ id }) => id === playerId)?.name ?? playerId;
}

function endedLine(outcome: GameOutcome, variant: VariantDefinition): string {
  const winner = playerName(variant, outcome.winnerPlayerId);

  switch (outcome.reason) {
    case "capture-royal":
      return `${winner} won by capturing the royal, ${pieceName(variant, outcome.capturedPieceId)}.`;
    case "reach-target":
      return `${winner} won: ${pieceName(variant, outcome.pieceId)} reached target ${coordinateToSquare(outcome.target)}.`;
    case "eliminate-all":
      return `${winner} won by capturing ${pieceName(variant, outcome.capturedPieceId)}, ${playerName(variant, outcome.loserPlayerId)}'s last piece.`;
    default: {
      const unhandled: never = outcome;
      return `${winner} won (${(unhandled as GameOutcome).reason}).`;
    }
  }
}

function typeName(variant: VariantDefinition, typeId: string): string {
  return variant.pieceTypes.find(({ id }) => id === typeId)?.name ?? typeId;
}

/** Matches the board adapter: the first player is drawn as white. */
function playerSide(variant: VariantDefinition, playerId: string): BoardSide {
  return playerId === variant.players[0]?.id ? "white" : "black";
}
