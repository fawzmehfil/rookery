import { describe, expect, it } from "vitest";
import { parseVariantDefinition, validateVariantDefinition } from "./index";
import { firstFlightVariant } from "./fixtures";
import type { ValidationCode } from "./validate-variant";

const draft = () => JSON.parse(JSON.stringify(firstFlightVariant));
type Draft = ReturnType<typeof draft>;

describe("semantic validation", () => {
  it("accepts First Flight and its JSON round trip without modifying input", () => {
    const v = draft();
    const before = JSON.stringify(v);
    expect(validateVariantDefinition(v)).toEqual([]);
    expect(validateVariantDefinition(JSON.parse(before))).toEqual([]);
    expect(parseVariantDefinition(v).ok).toBe(true);
    expect(JSON.stringify(v)).toBe(before);
  });

  const cases: [ValidationCode, (v: Draft) => void, (string | number)[]][] = [
    ["DUPLICATE_PLAYER_ID", v => { v.players[1].id = "white"; }, ["players", 1, "id"]],
    ["DUPLICATE_PIECE_TYPE_ID", v => { v.pieceTypes[1].id = "sovereign"; }, ["pieceTypes", 1, "id"]],
    ["DUPLICATE_PIECE_ID", v => { v.setup[1].id = v.setup[0].id; }, ["setup", 1, "id"]],
    ["TURN_ORDER_UNKNOWN_PLAYER", v => { v.turnOrder[0] = "unknown"; }, ["turnOrder", 0]],
    ["TURN_ORDER_DUPLICATE_PLAYER", v => { v.turnOrder[1] = "white"; }, ["turnOrder", 1]],
    ["TURN_ORDER_MISSING_PLAYER", v => { v.turnOrder[1] = "white"; }, ["players", 1, "id"]],
    ["DISABLED_CELL_OUT_OF_BOUNDS", v => { v.board.disabledCells = [{ file: 6, rank: 0 }]; }, ["board", "disabledCells", 0]],
    ["DUPLICATE_DISABLED_CELL", v => { v.board.disabledCells = [{ file: 1, rank: 1 }, { file: 1, rank: 1 }]; }, ["board", "disabledCells", 1]],
    ["UNKNOWN_PIECE_TYPE", v => { v.setup[0].typeId = "unknown"; }, ["setup", 0, "typeId"]],
    ["UNKNOWN_OWNER", v => { v.setup[0].ownerId = "unknown"; }, ["setup", 0, "ownerId"]],
    ["PIECE_OUT_OF_BOUNDS", v => { v.setup[0].at.file = 6; }, ["setup", 0, "at"]],
    ["PIECE_ON_DISABLED_CELL", v => { v.board.disabledCells = [v.setup[0].at]; }, ["setup", 0, "at"]],
    ["OVERLAPPING_PIECES", v => { v.setup[1].at = { ...v.setup[0].at }; }, ["setup", 1, "at"]],
    ["INVALID_ROYAL_COUNT", v => { v.setup = v.setup.filter((p: { id: string }) => p.id !== "white-sovereign"); }, ["players", 0]],
    ["NO_CAPTURE_MOVEMENT", v => { v.pieceTypes.forEach((p: { movements: { mode: string }[] }) => p.movements.forEach(m => { m.mode = "move-only"; })); }, ["players", 0]],
    ["NO_INITIAL_ACTIONS", v => { v.pieceTypes.forEach((p: { movements: unknown[] }) => { p.movements = [{ kind: "leap", frame: "board", mode: "move-or-capture", offsets: [{ fileDelta: 25, rankDelta: 25 }] }]; }); }, ["turnOrder", 0]],
    ["UNUSED_PIECE_TYPE", v => { v.pieceTypes.push({ ...v.pieceTypes[1], id: "unused" }); }, ["pieceTypes", 3]],
    ["SCHEMA_INVALID", v => { v.pieceTypes[0].movements[0].offsets = [{ fileDelta: 0, rankDelta: 0 }]; }, ["pieceTypes", 0, "movements", 0, "offsets", 0]],
  ];
  it.each(cases)("reports %s at a stable field path", (code, change, path) => {
    const v = draft(); change(v);
    const issues = validateVariantDefinition(v);
    expect(issues).toContainEqual({ code, path, severity: code === "UNUSED_PIECE_TYPE" ? "warning" : "error", message: expect.any(String) });
    expect(validateVariantDefinition(v)).toEqual(issues);
  });

  it("accumulates independent issues in exact traversal order", () => {
    const v = draft();
    v.setup[0].ownerId = "unknown";
    v.setup[0].at = { file: 8, rank: 8 };
    v.setup[2].at = { ...v.setup[1].at };
    expect(validateVariantDefinition(v).map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "UNKNOWN_OWNER", path: ["setup", 0, "ownerId"] },
      { code: "PIECE_OUT_OF_BOUNDS", path: ["setup", 0, "at"] },
      { code: "OVERLAPPING_PIECES", path: ["setup", 2, "at"] },
    ]);
  });

  it.each([null, undefined, 1, "not-json", {}, [], { schemaVersion: 8 }])("reports ordinary invalid input without throwing: %j", input => {
    expect(() => validateVariantDefinition(input)).not.toThrow();
    expect(validateVariantDefinition(input)[0]).toMatchObject({ code: "SCHEMA_INVALID", severity: "error" });
  });
});
