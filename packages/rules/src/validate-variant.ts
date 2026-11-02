import { parseVariantDefinition } from "./parse";
import { createInitialState, coordinateKey, isOnBoard } from "./create-initial-state";
import { getLegalActions } from "./get-legal-actions";

export type ValidationCode =
  | "SCHEMA_INVALID" | "DUPLICATE_PLAYER_ID" | "DUPLICATE_PIECE_TYPE_ID"
  | "DUPLICATE_PIECE_ID" | "TURN_ORDER_UNKNOWN_PLAYER" | "TURN_ORDER_DUPLICATE_PLAYER"
  | "TURN_ORDER_MISSING_PLAYER" | "DISABLED_CELL_OUT_OF_BOUNDS" | "DUPLICATE_DISABLED_CELL"
  | "UNKNOWN_PIECE_TYPE" | "UNKNOWN_OWNER" | "PIECE_OUT_OF_BOUNDS" | "PIECE_ON_DISABLED_CELL"
  | "OVERLAPPING_PIECES" | "INVALID_ROYAL_COUNT" | "NO_CAPTURE_MOVEMENT"
  | "NO_INITIAL_ACTIONS" | "UNUSED_PIECE_TYPE";

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
  const types = new Set(v.pieceTypes.map((p) => p.id));
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
  const royalTypes = new Set(v.pieceTypes.filter((p) => p.royal).map((p) => p.id));
  v.players.forEach((p, i) => {
    const owned = v.setup.filter((piece) => piece.ownerId === p.id);
    if (owned.filter((piece) => royalTypes.has(piece.typeId)).length !== 1)
      add("INVALID_ROYAL_COUNT", ["players", i], `${p.name} needs exactly one starting royal for capture-the-royal.`);
    if (!owned.some((piece) => v.pieceTypes.some((t) => t.id === piece.typeId && t.movements.some((m) => m.mode !== "move-only"))))
      add("NO_CAPTURE_MOVEMENT", ["players", i], `${p.name} needs a placed piece with capture-capable movement to win.`);
  });
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
