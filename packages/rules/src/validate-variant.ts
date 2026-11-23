import { parseVariantDefinition } from "./parse";
import { createInitialState, coordinateKey, isOnBoard } from "./create-initial-state";
import { getLegalActions } from "./get-legal-actions";

export type ValidationCode =
  | "SCHEMA_INVALID" | "DUPLICATE_PLAYER_ID" | "DUPLICATE_PIECE_TYPE_ID"
  | "DUPLICATE_PIECE_ID" | "TURN_ORDER_UNKNOWN_PLAYER" | "TURN_ORDER_DUPLICATE_PLAYER"
  | "TURN_ORDER_MISSING_PLAYER" | "DISABLED_CELL_OUT_OF_BOUNDS" | "DUPLICATE_DISABLED_CELL"
  | "UNKNOWN_PIECE_TYPE" | "UNKNOWN_OWNER" | "PIECE_OUT_OF_BOUNDS" | "PIECE_ON_DISABLED_CELL"
  | "OVERLAPPING_PIECES" | "INVALID_ROYAL_COUNT" | "NO_CAPTURE_MOVEMENT"
  | "NO_INITIAL_ACTIONS" | "UNUSED_PIECE_TYPE" | "NO_TARGET" | "UNKNOWN_TARGET_PLAYER"
  | "DUPLICATE_TARGET_PLAYER" | "TARGET_OUT_OF_BOUNDS" | "TARGET_DISABLED" | "DUPLICATE_TARGET_CELL"
  | "NO_ELIGIBLE_PIECES" | "UNKNOWN_ELIGIBLE_PIECE_TYPE" | "DUPLICATE_ELIGIBLE_PIECE_TYPE_ID"
  | "NO_INITIAL_PIECES" | "PIECE_INITIALIZED_ON_TARGET";

export type ValidationIssue = Readonly<{
  code: ValidationCode;
  severity: "error" | "warning";
  message: string;
  path: readonly (string | number)[];
}>;

/** JSON-like data only. Schema errors stop semantic traversal; independent semantic
 * issues accumulate in definition order. Warnings never block playtest handoff. */
export function validateVariantDefinition(input: unknown): readonly ValidationIssue[] {
  const parsed = parseVariantDefinition(input);
  if (!parsed.ok) return parsed.issues.map((issue) => ({ ...issue, code: "SCHEMA_INVALID", severity: "error" }));
  const v = parsed.value;
  const issues: ValidationIssue[] = [];
  const add = (code: ValidationCode, path: readonly (string | number)[], message: string, severity: "error" | "warning" = "error") => {
    issues.push({ code, severity, message, path });
  };
  const unique = (values: readonly string[], code: ValidationCode, prefix: string, suffix?: string) => {
    const seen = new Set<string>();
    values.forEach((value, i) => {
      if (seen.has(value)) add(code, suffix ? [prefix, i, suffix] : [prefix, i], `Duplicate ${value}; use a unique value.`);
      seen.add(value);
    });
  };
  unique(v.players.map((p) => p.id), "DUPLICATE_PLAYER_ID", "players", "id");
  unique(v.pieceTypes.map((p) => p.id), "DUPLICATE_PIECE_TYPE_ID", "pieceTypes", "id");
  unique(v.setup.map((p) => p.id), "DUPLICATE_PIECE_ID", "setup", "id");
  const players = new Set(v.players.map((p) => p.id));
  unique(v.turnOrder, "TURN_ORDER_DUPLICATE_PLAYER", "turnOrder");
  v.turnOrder.forEach((id, i) => {
    if (!players.has(id)) add("TURN_ORDER_UNKNOWN_PLAYER", ["turnOrder", i], `Unknown player ${id}; choose a defined player.`);
  });
  v.players.forEach((p, i) => {
    if (!v.turnOrder.includes(p.id)) add("TURN_ORDER_MISSING_PLAYER", ["players", i, "id"], `${p.name} must appear in turn order.`);
  });
  const onBoard = (at: { file: number; rank: number }) => isOnBoard(at, v.board.files, v.board.ranks);
  const disabled = new Set<string>();
  v.board.disabledCells.forEach((at, i) => {
    if (!onBoard(at)) add("DISABLED_CELL_OUT_OF_BOUNDS", ["board", "disabledCells", i], "Disabled cell must be inside the board.");
    if (disabled.has(coordinateKey(at))) add("DUPLICATE_DISABLED_CELL", ["board", "disabledCells", i], "This cell is already disabled.");
    disabled.add(coordinateKey(at));
  });
  const pieceTypesById = new Map(v.pieceTypes.map((pieceType) => [pieceType.id, pieceType]));
  const types = new Set(pieceTypesById.keys());
  const playableCells = Array.from({ length: v.board.files * v.board.ranks }, (_, index) => ({
    file: index % v.board.files,
    rank: Math.floor(index / v.board.files),
  })).filter((at) => !disabled.has(coordinateKey(at)));
  const playableCellKeys = new Set(playableCells.map(coordinateKey));
  const landableVectorCache = new Map<string, boolean>();
  const canLandOnPlayableCell = (fileDelta: number, rankDelta: number) => {
    const key = `${fileDelta},${rankDelta}`;
    const cached = landableVectorCache.get(key);
    if (cached !== undefined) return cached;
    const landable = playableCells.some((from) => playableCellKeys.has(coordinateKey({
      file: from.file + fileDelta,
      rank: from.rank + rankDelta,
    })));
    landableVectorCache.set(key, landable);
    return landable;
  };
  const occupied = new Set<string>();
  v.setup.forEach((p, i) => {
    if (!types.has(p.typeId)) add("UNKNOWN_PIECE_TYPE", ["setup", i, "typeId"], "Choose a defined piece type.");
    if (!players.has(p.ownerId)) add("UNKNOWN_OWNER", ["setup", i, "ownerId"], "Choose a defined player.");
    if (!onBoard(p.at)) add("PIECE_OUT_OF_BOUNDS", ["setup", i, "at"], "Move this piece inside the board.");
    const key = coordinateKey(p.at);
    if (disabled.has(key)) add("PIECE_ON_DISABLED_CELL", ["setup", i, "at"], "Move this piece off the disabled cell.");
    if (occupied.has(key)) add("OVERLAPPING_PIECES", ["setup", i, "at"], "Only one piece can occupy this cell.");
    occupied.add(key);
  });
  if (v.objectives[0]?.type === "capture-royal") {
    const royalTypes = new Set(v.pieceTypes.filter((p) => p.royal).map((p) => p.id));
    const captureCapabilityCache = new Map<string, boolean>();
    v.players.forEach((p, i) => {
      const owned = v.setup.filter((piece) => piece.ownerId === p.id);
      if (owned.filter((piece) => royalTypes.has(piece.typeId)).length !== 1)
        add("INVALID_ROYAL_COUNT", ["players", i], `${p.name} needs exactly one starting royal for capture-the-royal.`);
      const canCaptureOnBoard = (typeId: string) => {
        const cacheKey = `${p.id}\0${typeId}`;
        const cached = captureCapabilityCache.get(cacheKey);
        if (cached !== undefined) return cached;
        const pieceType = pieceTypesById.get(typeId);
        const capable = pieceType?.movements.some((movement) => {
          if (movement.mode === "move-only") return false;
          const vectors = movement.kind === "slide" ? movement.directions : movement.offsets;
          // A slide's first step suffices to prove that some capture edge exists.
          // Ignore occupancy and reachability: reject only geometric impossibility.
          return vectors.some((vector) => canLandOnPlayableCell(
            vector.fileDelta,
            vector.rankDelta * (movement.frame === "owner" ? p.forwardRank : 1),
          ));
        }) ?? false;
        captureCapabilityCache.set(cacheKey, capable);
        return capable;
      };
      if (![...new Set(owned.map((piece) => piece.typeId))].some(canCaptureOnBoard))
        add("NO_CAPTURE_MOVEMENT", ["players", i], `${p.name} needs a placed piece with capture-capable movement usable on this board to win.`);
    });
  }
  if (v.objectives[0]?.type === "reach-target") {
    const configuredPlayers = new Set<string>();

    v.objectives[0].targets.forEach((target, i) => {
      const targetPath = ["objectives", 0, "targets", i] as const;
      const configuredCells = new Set<string>();

      if (!players.has(target.playerId)) {
        add(
          "UNKNOWN_TARGET_PLAYER",
          [...targetPath, "playerId"],
          `Unknown player ${target.playerId}; assign this target to a defined player.`,
        );
      }
      if (configuredPlayers.has(target.playerId)) {
        add(
          "DUPLICATE_TARGET_PLAYER",
          [...targetPath, "playerId"],
          "Each player must have exactly one target configuration.",
        );
      }
      configuredPlayers.add(target.playerId);

      target.cells.forEach((cell, j) => {
        const path = [...targetPath, "cells", j];

        if (!onBoard(cell)) {
          add("TARGET_OUT_OF_BOUNDS", path, "Target must be inside the board.");
        }
        const key = coordinateKey(cell);

        if (disabled.has(key)) {
          add("TARGET_DISABLED", path, "Target cannot be on a disabled cell.");
        }
        if (configuredCells.has(key)) {
          add("DUPLICATE_TARGET_CELL", path, "A target cell may appear only once in the objective.");
        }
        configuredCells.add(key);
      });

      const eligibleIds = target.eligiblePieceTypeIds ?? v.pieceTypes.map((pieceType) => pieceType.id);
      const seenTypes = new Set<string>();

      eligibleIds.forEach((typeId, j) => {
        const path = [...targetPath, "eligiblePieceTypeIds", j];

        if (!types.has(typeId)) {
          add("UNKNOWN_ELIGIBLE_PIECE_TYPE", path, `Unknown piece type ${typeId}.`);
        }
        if (seenTypes.has(typeId)) {
          add("DUPLICATE_ELIGIBLE_PIECE_TYPE_ID", path, `Piece type ${typeId} is listed more than once.`);
        }
        seenTypes.add(typeId);
      });

      const eligiblePieces = v.setup.filter(
        (piece) =>
          piece.ownerId === target.playerId &&
          eligibleIds.includes(piece.typeId) &&
          types.has(piece.typeId),
      );

      if (players.has(target.playerId) && eligiblePieces.length === 0) {
        add("NO_ELIGIBLE_PIECES", targetPath, "This player needs at least one initially placed eligible piece.");
      }
      const targetCells = new Set(target.cells.map(coordinateKey));

      eligiblePieces.forEach((piece) => {
        if (targetCells.has(coordinateKey(piece.at))) {
          add(
            "PIECE_INITIALIZED_ON_TARGET",
            ["setup", v.setup.indexOf(piece), "at"],
            "An eligible piece cannot start on its target cell.",
          );
        }
      });
    });

    v.players.forEach((player, i) => {
      if (!configuredPlayers.has(player.id)) {
        add("NO_TARGET", ["players", i], `${player.name} needs a target configuration.`);
      }
    });
  }
  if (v.objectives[0]?.type === "eliminate-all") {
    v.players.forEach((player, i) => {
      if (!v.setup.some((piece) => piece.ownerId === player.id)) {
        add("NO_INITIAL_PIECES", ["players", i], `${player.name} needs at least one starting piece.`);
      }
    });
  }
  // Avoid cascading engine diagnostics when references or positions are invalid.
  if (!issues.some((i) => i.severity === "error")) {
    const initial = createInitialState(v);
    if (initial.ok && getLegalActions(v, initial.value).length === 0)
      add("NO_INITIAL_ACTIONS", ["turnOrder", 0], "The starting player has no legal action; change the setup or movement rules.");
  }
  v.pieceTypes.forEach((p, i) => {
    if (!v.setup.some((piece) => piece.typeId === p.id))
      add("UNUSED_PIECE_TYPE", ["pieceTypes", i], `${p.name} has no starting pieces.`, "warning");
  });
  return issues;
}
