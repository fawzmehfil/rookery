import { describe, expect, it } from "vitest";
import { parseVariantDefinition, validateVariantDefinition } from "./index";
import { firstFlightVariant } from "./fixtures";
import type { ValidationCode } from "./validate-variant";

const draft = () => JSON.parse(JSON.stringify(firstFlightVariant));
type Draft = ReturnType<typeof draft>;

// Adapt the canonical fixture for the alternate Sprint 2 objectives.
const reachTargetDraft = () => {
  const v = draft();
  v.schemaVersion = 2;
  const emptyCells: { file: number; rank: number }[] = [];
  for (let rank = 0; rank < v.board.ranks; rank++) {
    for (let file = 0; file < v.board.files; file++) {
      const occupied = v.setup.some((p: { at: { file: number; rank: number } }) =>p.at.file === file && p.at.rank === rank);
      const disabled = v.board.disabledCells.some((cell: { file: number; rank: number }) =>cell.file === file && cell.rank === rank);
      if (!occupied && !disabled) emptyCells.push({ file, rank });
  }}
  v.objectives = [{type: "reach-target", requireAction: true, targets: v.players.map((player: { id: string }, i: number) => ({playerId: player.id, cells: [emptyCells[i]],}))}];
  return v;
};
const eliminateAllDraft = () => {
  const v = draft();
  v.schemaVersion = 2; v.objectives = [{ type: "eliminate-all" }];
  return v;
};

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
    ["NO_INITIAL_ACTIONS", v => { v.pieceTypes.forEach((p: { movements: unknown[] }) => { p.movements = [{ kind: "step", frame: "board", mode: "capture-only", offsets: [{ fileDelta: 0, rankDelta: 1 }] }]; }); }, ["turnOrder", 0]],
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

  it("rejects capture vectors that cannot land anywhere on the playable board", () => {
    const v = draft();
    v.pieceTypes.forEach((p: { movements: unknown[] }) => {
      p.movements = [{ kind: "leap", frame: "owner", mode: "move-or-capture", offsets: [{ fileDelta: 25, rankDelta: 25 }] }];
    });
    expect(validateVariantDefinition(v).filter(i => i.code === "NO_CAPTURE_MOVEMENT").map(i => i.path)).toEqual([["players", 0], ["players", 1]]);
  });

  it("bounds capture analysis for a near-maximum adversarial definition", () => {
    const slowMovements = Array.from({ length: 64 }, () => ({
      kind: "leap" as const,
      frame: "board" as const,
      mode: "move-or-capture" as const,
      offsets: Array.from({ length: 64 }, () => ({ fileDelta: 25, rankDelta: 25 })),
    }));
    const setup = [];
    for (let rank = 0; rank < 26; rank++) for (let file = 0; file < 26; file++) {
      if ((file === 25 && rank === 25) || (rank === 0 && (file === 0 || file === 1))) continue;
      setup.push({
        id: `slow-${file}-${rank}`,
        typeId: "slow",
        ownerId: (file + rank) % 2 === 0 ? "white" : "black",
        at: { file, rank },
      });
    }
    setup.push(
      { id: "white-royal", typeId: "royal", ownerId: "white", at: { file: 0, rank: 0 } },
      { id: "black-royal", typeId: "royal", ownerId: "black", at: { file: 1, rank: 0 } },
    );
    const input = {
      schemaVersion: 1,
      id: "validator-stress",
      name: "Validator stress fixture",
      board: { files: 26, ranks: 26, disabledCells: [{ file: 25, rank: 25 }] },
      players: [
        { id: "white", name: "White", forwardRank: 1 },
        { id: "black", name: "Black", forwardRank: -1 },
      ],
      turnOrder: ["white", "black"],
      pieceTypes: [
        { id: "slow", name: "Slow", royal: false, movements: slowMovements },
        { id: "royal", name: "Royal", royal: true, movements: [{
          kind: "step", frame: "board", mode: "move-or-capture", offsets: [{ fileDelta: 1, rankDelta: 0 }],
        }] },
      ],
      setup,
      objectives: [{ type: "capture-royal" }],
    };

    expect(setup).toHaveLength(675);
    expect(validateVariantDefinition(input)).toEqual([]);
  }, 2_000);

  it.each([null, undefined, 1, "not-json", {}, [], { schemaVersion: 8 }])("reports ordinary invalid input without throwing: %j", input => {
    expect(() => validateVariantDefinition(input)).not.toThrow();
    expect(validateVariantDefinition(input)[0]).toMatchObject({ code: "SCHEMA_INVALID", severity: "error" });
  });

  const targetCases: [ValidationCode, (v: Draft) => void, (string | number)[]][] = [
    ["TARGET_OUT_OF_BOUNDS", v => {v.objectives[0].targets[0].cells[0] = { file: 6, rank: 0 };}, ["objectives", 0, "targets", 0, "cells", 0]],
    ["TARGET_DISABLED", v => {const cell = v.objectives[0].targets[0].cells[0];v.board.disabledCells.push({ ...cell });}, ["objectives", 0, "targets", 0, "cells", 0]],
    ["DUPLICATE_TARGET_CELL", v => {const cell = v.objectives[0].targets[0].cells[0];v.objectives[0].targets[0].cells.push({ ...cell });}, ["objectives", 0, "targets", 0, "cells", 1]],
    ["UNKNOWN_TARGET_PLAYER", v => {v.objectives[0].targets[0].playerId = "unknown";}, ["objectives", 0, "targets", 0, "playerId"]],
    ["DUPLICATE_TARGET_PLAYER", v => {v.objectives[0].targets[1].playerId = v.objectives[0].targets[0].playerId;}, ["objectives", 0, "targets", 1, "playerId"]],
    ["NO_TARGET", v => {v.objectives[0].targets[1].playerId = v.objectives[0].targets[0].playerId;}, ["players", 1]],
    ["UNKNOWN_ELIGIBLE_PIECE_TYPE", v => {v.objectives[0].targets[0].eligiblePieceTypeIds = ["unknown"];}, ["objectives", 0, "targets", 0, "eligiblePieceTypeIds", 0]],
    ["DUPLICATE_ELIGIBLE_PIECE_TYPE_ID", v => {const typeId = v.pieceTypes[0].id; v.objectives[0].targets[0].eligiblePieceTypeIds = [typeId, typeId];}, ["objectives", 0, "targets", 0, "eligiblePieceTypeIds", 1]],
    ["NO_ELIGIBLE_PIECES", v => {const unusedType = { ...v.pieceTypes[0], id: "unused-eligible" };v.pieceTypes.push(unusedType);v.objectives[0].targets[0].eligiblePieceTypeIds = ["unused-eligible"];}, ["objectives", 0, "targets", 0]],
    ["PIECE_INITIALIZED_ON_TARGET", v => {const piece = v.setup.find((p: { ownerId: string }) => p.ownerId === v.objectives[0].targets[0].playerId); v.objectives[0].targets[0].cells[0] = { ...piece.at };}, ["setup", 0, "at"]],
  ];
  it.each(targetCases)("reports reach-target issue %s at a stable field path", (code, change, path) => {
    const v = reachTargetDraft(); change(v);
    const issues = validateVariantDefinition(v);
    expect(issues).toContainEqual({code, path, severity: "error", message: expect.any(String)});
    expect(validateVariantDefinition(v)).toEqual(issues);
  });

  it("requires each player to have at least one starting piece for eliminate-all", () => {
    const v = eliminateAllDraft();
    const secondPlayer = v.players[1].id;
    v.setup = v.setup.filter((piece: { ownerId: string }) => piece.ownerId !== secondPlayer);
    const issues = validateVariantDefinition(v);
    expect(issues).toContainEqual({code: "NO_INITIAL_PIECES", path: ["players", 1], severity: "error", message: expect.any(String),});
  });

  it("reports independent reach-target issues deterministically without modifying the draft", () => {
    const v = reachTargetDraft();
    v.objectives[0].targets[1].playerId = v.objectives[0].targets[0].playerId;
    v.objectives[0].targets[1].cells.push({ ...v.objectives[0].targets[1].cells[0] });
    const typeId = v.pieceTypes[0].id;
    v.objectives[0].targets[1].eligiblePieceTypeIds = [typeId, typeId];
    const before = JSON.stringify(v);

    const first = validateVariantDefinition(v);
    const second = validateVariantDefinition(v);

    expect(second).toEqual(first);
    expect(JSON.stringify(v)).toBe(before);
    expect(first.map(({ code }) => code)).toEqual([
      "DUPLICATE_TARGET_PLAYER",
      "DUPLICATE_TARGET_CELL",
      "DUPLICATE_ELIGIBLE_PIECE_TYPE_ID",
      "NO_TARGET",
    ]);
  });

  it("accepts every pair of empty target cells, including a target shared by both players", () => {
    const base = reachTargetDraft();
    const emptyCells = Array.from({ length: base.board.files * base.board.ranks }, (_, index) => ({
      file: index % base.board.files,
      rank: Math.floor(index / base.board.files),
    })).filter((cell) => !base.setup.some((piece: { at: { file: number; rank: number } }) =>
      piece.at.file === cell.file && piece.at.rank === cell.rank));

    for (const whiteTarget of emptyCells) {
      for (const blackTarget of emptyCells) {
        const candidate = structuredClone(base);
        candidate.objectives[0].targets[0].cells = [whiteTarget];
        candidate.objectives[0].targets[1].cells = [blackTarget];
        expect(validateVariantDefinition(candidate)).toEqual([]);
      }
    }
  });

});
