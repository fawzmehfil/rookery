import { describe, expect, it } from "vitest";
import { parseVariantDefinition, type MovementPattern, type VariantDefinition } from "@rookery/rules";
import { firstFlightVariant as v } from "@rookery/rules/fixtures";
import { movePiece, placePiece, playtestDraft, removePiece, replacePiece, resizeBoard, resizeImpact, setCellDisabled, setMovement } from "./model";

describe("immutable editor operations", () => {
  it("bounds resize and requires confirmation before discarding pieces or disabled cells", () => {
    const original = { ...v, board: { ...v.board, disabledCells: [{ file: 3, rank: 3 }] } };
    expect(resizeImpact(original, 3, 3).pieces).toHaveLength(4);
    expect(resizeBoard(original, 3, 3).ok).toBe(false);
    const result = resizeBoard(original, 3, 3, true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.setup).toHaveLength(2);
    expect(result.value.board.disabledCells).toEqual([]);
    expect(original.setup).toHaveLength(6);
    expect(original.board.disabledCells).toHaveLength(1);
    for (const dimension of [0, 27, 2.5, NaN]) expect(resizeBoard(v, dimension, 5, true).ok).toBe(false);
    expect(resizeBoard(v, 26, 26).ok).toBe(true);
    expect(resizeBoard(v, 1, 1, true).ok).toBe(true);
  });

  it("places, moves, replaces and removes without overlap or changing IDs", () => {
    const before = JSON.stringify(v);
    const placed = placePiece(v, { file: 1, rank: 1 }, "tower", "white");
    if (!placed.ok) throw new Error(placed.message);
    const piece = placed.value.setup.at(-1)!;
    const moved = movePiece(placed.value, piece.id, { file: 1, rank: 2 });
    if (!moved.ok) throw new Error(moved.message);
    const replaced = replacePiece(moved.value, { file: 1, rank: 2 }, "hopper", "black");
    if (!replaced.ok) throw new Error(replaced.message);
    expect(replaced.value.setup.at(-1)).toEqual({ id: piece.id, ownerId: "black", typeId: "hopper", at: { file: 1, rank: 2 } });
    expect(placePiece(v, v.setup[0].at, "tower", "white").ok).toBe(false);
    expect(movePiece(placed.value, piece.id, v.setup[0].at).ok).toBe(false);
    expect(removePiece(replaced.value, { file: 1, rank: 2 })).toEqual({ ok: true, value: v });
    expect(JSON.stringify(v)).toBe(before);
  });

  it("rejects disabled cells, occupied disabling, unknown references and off-board placement", () => {
    const disabled = setCellDisabled(v, { file: 1, rank: 1 }, true);
    if (!disabled.ok) throw new Error(disabled.message);
    expect(placePiece(disabled.value, { file: 1, rank: 1 }, "tower", "white").ok).toBe(false);
    expect(movePiece(disabled.value, v.setup[0].id, { file: 1, rank: 1 }).ok).toBe(false);
    expect(setCellDisabled(v, v.setup[0].at, true).ok).toBe(false);
    expect(setCellDisabled(disabled.value, { file: 1, rank: 1 }, false)).toEqual({ ok: true, value: v });
    expect(placePiece(v, { file: 25, rank: 25 }, "tower", "white").ok).toBe(false);
    expect(placePiece(v, { file: 1, rank: 1 }, "unknown", "white").ok).toBe(false);
    expect(placePiece(v, { file: 1, rank: 1 }, "tower", "unknown").ok).toBe(false);
  });

  it("allocates unique IDs through repeated placements", () => {
    let current = v;
    for (let file = 0; file < 5; file++) {
      const result = placePiece(current, { file, rank: 1 }, "tower", "white");
      if (!result.ok) throw new Error(result.message);
      current = result.value;
    }
    expect(new Set(current.setup.map(p => p.id)).size).toBe(current.setup.length);
  });
});

describe("exact shared movement output", () => {
  for (const kind of ["step", "slide", "leap"] as const) for (const frame of ["board", "owner"] as const)
    for (const mode of ["move-only", "capture-only", "move-or-capture"] as const) {
      it(`${kind}/${frame}/${mode} preserves unrelated data`, () => {
        const vectors = [{ fileDelta: 1, rankDelta: 1 }];
        const rule: MovementPattern = kind === "slide" ? { kind, frame, mode, directions: vectors, maxDistance: 3 } : { kind, frame, mode, offsets: vectors };
        const result = setMovement(v, "tower", 0, rule);
        if (!result.ok) throw new Error(result.message);
        expect(result.value.pieceTypes[1].movements).toEqual([rule]);
        expect(result.value.pieceTypes[0]).toBe(v.pieceTypes[0]);
        expect(result.value.pieceTypes[2]).toBe(v.pieceTypes[2]);
        for (const key of ["board", "setup", "players", "turnOrder", "objectives"] as const) expect(result.value[key]).toBe(v[key]);
        expect(parseVariantDefinition(result.value).ok).toBe(true);
        const resized = resizeBoard(result.value, 6, 6);
        if (!resized.ok) throw new Error(resized.message);
        expect(resized.value.pieceTypes).toBe(result.value.pieceTypes);
      });
    }
  it("rejects malformed vectors and distances before changing a draft", () => {
    for (const rule of [
      { kind: "step", frame: "board", mode: "move-only", offsets: [{ fileDelta: 0, rankDelta: 0 }] },
      { kind: "step", frame: "board", mode: "move-only", offsets: [{ fileDelta: 2, rankDelta: 0 }] },
      { kind: "slide", frame: "board", mode: "move-only", directions: [{ fileDelta: 2, rankDelta: 2 }] },
      { kind: "slide", frame: "board", mode: "move-only", directions: [{ fileDelta: 1, rankDelta: 0 }], maxDistance: 0 },
    ]) expect(setMovement(v, "tower", 0, rule).ok).toBe(false);
  });
  it("round trips First Flight and blocks invalid handoff", () => {
    expect(playtestDraft(v)).toEqual(v);
    expect(playtestDraft(JSON.parse(JSON.stringify(v)))).toEqual(v);
    const invalid: VariantDefinition = { ...v, setup: v.setup.filter(p => p.id !== "white-sovereign") };
    expect(playtestDraft(invalid)).toBeNull();
    expect(invalid.setup).toHaveLength(5);
  });
});
