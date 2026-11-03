import {
  movementPatternSchema, parseVariantDefinition, validateVariantDefinition,
  type Coordinate, type MovementPattern, type VariantDefinition,
} from "@rookery/rules";

export type EditResult = { ok: true; value: VariantDefinition } | { ok: false; message: string };
const fail = (message: string): EditResult => ({ ok: false, message });
const success = (value: VariantDefinition): EditResult => ({ ok: true, value });
export const sameCell = (a: Coordinate, b: Coordinate) => a.file === b.file && a.rank === b.rank;
export const onBoard = (v: VariantDefinition, at: Coordinate) => Number.isInteger(at.file) && Number.isInteger(at.rank)
  && at.file >= 0 && at.rank >= 0 && at.file < v.board.files && at.rank < v.board.ranks;

export function resizeImpact(v: VariantDefinition, files: number, ranks: number) {
  const outside = (at: Coordinate) => at.file >= files || at.rank >= ranks;
  return {
    pieces: v.setup.filter(p => outside(p.at)),
    disabledCells: v.board.disabledCells.filter(outside),
  };
}

export function resizeBoard(v: VariantDefinition, files: number, ranks: number, confirmed = false): EditResult {
  if (![files, ranks].every(n => Number.isInteger(n) && n >= 1 && n <= 26)) return fail("Files and ranks must be whole numbers from 1 to 26.");
  const impact = resizeImpact(v, files, ranks);
  if (!confirmed && (impact.pieces.length || impact.disabledCells.length)) return fail("Confirm the resize before removing pieces or disabled cells.");
  return success({ ...v, board: { ...v.board, files, ranks,
    disabledCells: v.board.disabledCells.filter(at => at.file < files && at.rank < ranks) },
    setup: v.setup.filter(p => p.at.file < files && p.at.rank < ranks) });
}

export function placePiece(v: VariantDefinition, at: Coordinate, typeId: string, ownerId: string): EditResult {
  if (!onBoard(v, at) || v.board.disabledCells.some(cell => sameCell(cell, at))) return fail("Choose an enabled cell inside the board.");
  if (v.setup.some(p => sameCell(p.at, at))) return fail("This cell is occupied. Select Replace to change its piece.");
  if (!v.players.some(p => p.id === ownerId) || !v.pieceTypes.some(p => p.id === typeId)) return fail("Choose an existing player and piece type.");
  let serial = 1;
  while (v.setup.some(p => p.id === `editor-piece-${serial}`)) serial++;
  return success({ ...v, setup: [...v.setup, { id: `editor-piece-${serial}`, at: { ...at }, typeId, ownerId }] });
}

export function movePiece(v: VariantDefinition, id: string, at: Coordinate): EditResult {
  if (!v.setup.some(p => p.id === id)) return fail("Select an existing piece.");
  if (!onBoard(v, at) || v.board.disabledCells.some(cell => sameCell(cell, at))) return fail("Choose an enabled cell inside the board.");
  if (v.setup.some(p => p.id !== id && sameCell(p.at, at))) return fail("Move to an empty cell; pieces cannot overlap.");
  return success({ ...v, setup: v.setup.map(p => p.id === id ? { ...p, at: { ...at } } : p) });
}

export function replacePiece(v: VariantDefinition, at: Coordinate, typeId: string, ownerId: string): EditResult {
  if (!v.setup.some(p => sameCell(p.at, at))) return fail("Choose an occupied cell to replace a piece.");
  if (!v.players.some(p => p.id === ownerId) || !v.pieceTypes.some(p => p.id === typeId)) return fail("Choose an existing player and piece type.");
  return success({ ...v, setup: v.setup.map(p => sameCell(p.at, at) ? { ...p, typeId, ownerId } : p) });
}

export function removePiece(v: VariantDefinition, at: Coordinate): EditResult {
  if (!v.setup.some(p => sameCell(p.at, at))) return fail("There is no piece on this cell.");
  return success({ ...v, setup: v.setup.filter(p => !sameCell(p.at, at)) });
}

export function setCellDisabled(v: VariantDefinition, at: Coordinate, disabled: boolean): EditResult {
  if (!onBoard(v, at)) return fail("Choose a cell inside the board.");
  if (disabled && v.setup.some(p => sameCell(p.at, at))) return fail("Remove or move this piece before disabling its cell.");
  return success({ ...v, board: { ...v.board, disabledCells: [
    ...v.board.disabledCells.filter(cell => !sameCell(cell, at)), ...(disabled ? [{ ...at }] : []),
  ] } });
}

export function setMovement(v: VariantDefinition, typeId: string, index: number, input: unknown): EditResult {
  const parsed = movementPatternSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(" "));
  const type = v.pieceTypes.find(p => p.id === typeId);
  if (!type || index < 0 || index > type.movements.length || (index === type.movements.length && index >= 64)) return fail("Choose an existing rule or add up to 64 rules.");
  const rule: MovementPattern = parsed.data;
  return success({ ...v, pieceTypes: v.pieceTypes.map(p => p.id === typeId ? {
    ...p, movements: index === p.movements.length ? [...p.movements, rule] : p.movements.map((m, i) => i === index ? rule : m),
  } : p) });
}

export function removeMovement(v: VariantDefinition, typeId: string, index: number): VariantDefinition {
  return { ...v, pieceTypes: v.pieceTypes.map(p => p.id === typeId ? { ...p, movements: p.movements.filter((_, i) => i !== index) } : p) };
}

/** Exact shared contract for Task 07; a bad draft is retained by the editor. */
export function playtestDraft(v: VariantDefinition): VariantDefinition | null {
  const parsed = parseVariantDefinition(v);
  return parsed.ok && !validateVariantDefinition(parsed.value).some(i => i.severity === "error") ? parsed.value : null;
}
