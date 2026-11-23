import { describe, expect, it } from "vitest";
import { createPieceTypeFromTemplate, type VariantDefinition } from "@rookery/rules";
import { firstFlightVariant, lastFlockStandingVariant, longWalkVariant } from "@rookery/rules/fixtures";
import {
  decodeEnvelope,
  ENVELOPE_FORMAT,
  exportDraft,
  exportFileName,
  MAX_IMPORT_BYTES,
  parseImportText,
} from "./envelope";

/** A valid variant exercising disabled cells, owner-relative movement and fairy templates. */
const fairyVariant: VariantDefinition = {
  ...firstFlightVariant,
  schemaVersion: 2,
  id: "fairy-court",
  name: "Fairy Court",
  board: { files: 6, ranks: 6, disabledCells: [{ file: 2, rank: 2 }, { file: 3, rank: 3 }] },
  pieceTypes: [
    ...firstFlightVariant.pieceTypes,
    createPieceTypeFromTemplate("nightrider", { id: "nightrider" }),
    createPieceTypeFromTemplate("camel", { id: "camel" }),
    createPieceTypeFromTemplate("chancellor", { id: "chancellor", name: "Empress" }),
    createPieceTypeFromTemplate("pawn", { id: "pawn" }),
  ],
  setup: [
    ...firstFlightVariant.setup,
    { id: "white-nightrider", typeId: "nightrider", ownerId: "white", at: { file: 5, rank: 0 } },
    { id: "black-camel", typeId: "camel", ownerId: "black", at: { file: 5, rank: 5 } },
    { id: "white-chancellor", typeId: "chancellor", ownerId: "white", at: { file: 1, rank: 0 } },
    { id: "black-pawn", typeId: "pawn", ownerId: "black", at: { file: 1, rank: 4 } },
  ],
  objectives: [{ type: "capture-royal" }],
};

const roundTripCases: readonly (readonly [string, VariantDefinition])[] = [
  ["First Flight (schema version 1)", firstFlightVariant],
  ["The Long Walk (reach-target)", longWalkVariant],
  ["Last Flock Standing (eliminate-all)", lastFlockStandingVariant],
  ["disabled cells and fairy templates", fairyVariant],
];

function exported(variant: VariantDefinition) {
  const result = exportDraft(variant);
  if (!result.ok) throw new Error(`Expected a valid export: ${JSON.stringify(result.issues)}`);
  return result;
}

function importText(text: string) {
  return parseImportText(text, new TextEncoder().encode(text).length);
}

function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorderKeys(item)]));
}

describe("export and import round trips", () => {
  it.each(roundTripCases)("round-trips %s without losing any variant data", (_, variant) => {
    const result = importText(exported(variant).text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variant).toEqual(variant);
    expect(result.source).toBe("envelope");
    expect(result.variant).not.toBe(variant);
  });

  it("preserves reach-target targets and eligible piece types exactly", () => {
    const result = importText(exported(longWalkVariant).text);
    if (!result.ok) throw new Error("Expected The Long Walk to import");

    expect(result.variant.objectives).toEqual([
      {
        type: "reach-target",
        requireAction: true,
        targets: [
          { playerId: "white", cells: [{ file: 0, rank: 2 }], eligiblePieceTypeIds: ["runner"] },
          { playerId: "black", cells: [{ file: 2, rank: 0 }], eligiblePieceTypeIds: ["runner"] },
        ],
      },
    ]);
  });

  it("returns an independent copy that does not share objects with the parsed input", () => {
    const text = exported(fairyVariant).text;
    const result = importText(text);
    if (!result.ok) throw new Error("Expected the fairy variant to import");

    expect(Object.isFrozen(result.variant)).toBe(false);
    expect(result.variant.board.disabledCells).not.toBe(fairyVariant.board.disabledCells);
  });
});

describe("deterministic export", () => {
  it("produces byte-identical text and filenames for the same draft", () => {
    const first = exported(lastFlockStandingVariant);
    const second = exported(structuredClone(lastFlockStandingVariant));

    expect(second).toEqual(first);
    expect(first.fileName).toBe("last-flock-standing.rookery.json");
  });

  it("serializes in canonical schema key order regardless of input key order", () => {
    const shuffled = reorderKeys(fairyVariant) as VariantDefinition;

    expect(exported(shuffled).text).toBe(exported(fairyVariant).text);
  });

  it("writes readable versioned JSON with only envelope metadata and the variant", () => {
    const { text } = exported(longWalkVariant);
    const envelope = JSON.parse(text) as Record<string, unknown>;

    expect(text.startsWith('{\n  "format": "rookery.variant-draft",\n  "envelopeVersion": 1,')).toBe(true);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).not.toContain("\r");
    expect(Object.keys(envelope)).toEqual(["format", "envelopeVersion", "variantSchemaVersion", "variant"]);
    expect(envelope.variantSchemaVersion).toBe(2);
  });

  it("never includes save timestamps, UI state, tokens or game state", () => {
    const { text } = exported(fairyVariant);

    for (const leaked of ["savedAt", "token", "selected", "tool", "ply", "activePlayerId", "history", "outcome"]) {
      expect(text).not.toContain(`"${leaked}"`);
    }
  });

  it("refuses to export a draft with blocking issues", () => {
    const withoutWhiteRoyal = { ...firstFlightVariant, setup: firstFlightVariant.setup.filter(({ id }) => id !== "white-sovereign") };
    const result = exportDraft(withoutWhiteRoyal);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VARIANT_INVALID");
    expect(result.issues.map(({ code }) => code)).toContain("INVALID_ROYAL_COUNT");
  });

  it.each([
    [{ id: "first-flight", name: "First Flight" }, "first-flight.rookery.json"],
    [{ id: "", name: "My  Variant!! v2" }, "my-variant-v2.rookery.json"],
    [{ id: "", name: "../../etc/passwd" }, "etc-passwd.rookery.json"],
    [{ id: "", name: "♜♜♜" }, "variant.rookery.json"],
    [{ id: `a${"-b".repeat(60)}`, name: "Long" }, `a${"-b".repeat(31)}.rookery.json`],
  ])("sanitizes the filename for %j", (variant, fileName) => {
    expect(exportFileName(variant)).toBe(fileName);
  });
});

describe("legacy and envelope inputs", () => {
  it("accepts a bare Sprint 1 variant download as legacy data without upgrading it", () => {
    const result = importText(JSON.stringify(firstFlightVariant, null, 2));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("legacy-variant");
    expect(result.variant.schemaVersion).toBe(1);
    expect(result.variant).toEqual(firstFlightVariant);
  });

  it("accepts a stored envelope and reports its saved timestamp", () => {
    const savedAt = "2026-11-14T17:04:12.345Z";
    const result = decodeEnvelope({ format: ENVELOPE_FORMAT, envelopeVersion: 1, variantSchemaVersion: 2, savedAt, variant: longWalkVariant });

    expect(result).toMatchObject({ ok: true, source: "envelope", savedAt });
  });
});

describe("rejected inputs", () => {
  const envelope = (overrides: Record<string, unknown>) => JSON.stringify({
    format: ENVELOPE_FORMAT,
    envelopeVersion: 1,
    variantSchemaVersion: 2,
    variant: longWalkVariant,
    ...overrides,
  });

  it("rejects files above the size limit before parsing and accepts the exact limit", () => {
    const atLimit = exported(firstFlightVariant).text.padEnd(MAX_IMPORT_BYTES, " ");

    expect(parseImportText(atLimit, MAX_IMPORT_BYTES).ok).toBe(true);
    expect(parseImportText("{}", MAX_IMPORT_BYTES + 1)).toMatchObject({ ok: false, code: "IMPORT_TOO_LARGE" });
    expect(parseImportText(`${atLimit} `, MAX_IMPORT_BYTES)).toMatchObject({ ok: false, code: "IMPORT_TOO_LARGE" });
  });

  it.each([
    ["", "IMPORT_EMPTY"],
    [" \n\t ", "IMPORT_EMPTY"],
    ["{not json", "IMPORT_NOT_JSON"],
    ["export default {}", "IMPORT_NOT_JSON"],
    ["[]", "ENVELOPE_MALFORMED"],
    ["null", "ENVELOPE_MALFORMED"],
    ['"variant"', "ENVELOPE_MALFORMED"],
    ["42", "ENVELOPE_MALFORMED"],
    ["{}", "ENVELOPE_MALFORMED"],
  ])("rejects %j with %s", (text, code) => {
    expect(importText(text)).toMatchObject({ ok: false, code });
  });

  it("does not leak parser exception text for invalid JSON", () => {
    const result = importText("{\"format\": }");

    expect(result).toEqual({ ok: false, code: "IMPORT_NOT_JSON", message: "This file is not valid JSON. Choose a Rookery export.", issues: [] });
  });

  it("rejects envelopes from a newer release with the found version", () => {
    const result = importText(envelope({ envelopeVersion: 2 }));

    expect(result).toMatchObject({ ok: false, code: "ENVELOPE_UNSUPPORTED_VERSION" });
    if (result.ok) return;
    expect(result.issues[0]).toMatchObject({ path: ["envelopeVersion"] });
    expect(result.issues[0]?.message).toContain("version 2");
  });

  it.each([
    [{ format: "something-else" }, ["format"]],
    [{ envelopeVersion: "1" }, ["envelopeVersion"]],
    [{ variantSchemaVersion: 1 }, ["variantSchemaVersion"]],
    [{ savedAt: "yesterday" }, ["savedAt"]],
    [{ extra: true }, ["extra"]],
  ])("rejects malformed envelope field %j at its path", (overrides, path) => {
    const result = importText(envelope(overrides));

    expect(result).toMatchObject({ ok: false, code: "ENVELOPE_MALFORMED" });
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path)).toContainEqual(path);
  });

  it("rejects an envelope without a variant", () => {
    const result = importText(JSON.stringify({ format: ENVELOPE_FORMAT, envelopeVersion: 1, variantSchemaVersion: 2 }));

    expect(result).toMatchObject({ ok: false, code: "ENVELOPE_MALFORMED" });
  });

  it("rejects prototype-pollution keys without polluting Object.prototype", () => {
    const hostileEnvelope = `{"__proto__":{"polluted":true},"format":"${ENVELOPE_FORMAT}","envelopeVersion":1,"variantSchemaVersion":2,"variant":${JSON.stringify(longWalkVariant)}}`;
    const hostileVariant = JSON.stringify(longWalkVariant).replace("{", '{"constructor":{"prototype":{"polluted":true}},"__proto__":{"polluted":true},');

    expect(importText(hostileEnvelope)).toMatchObject({ ok: false, code: "ENVELOPE_MALFORMED" });
    expect(importText(hostileVariant)).toMatchObject({ ok: false, code: "VARIANT_INVALID" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects overlong strings with the field path", () => {
    const result = importText(envelope({ variant: { ...longWalkVariant, name: "x".repeat(10_000) } }));

    expect(result).toMatchObject({ ok: false, code: "VARIANT_INVALID" });
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "SCHEMA_INVALID", path: ["name"] }));
  });

  it("reports structural issues with their exact paths", () => {
    const result = importText(envelope({ variant: { ...longWalkVariant, board: { files: 0, ranks: 3, disabledCells: [] } } }));

    expect(result).toMatchObject({ ok: false, code: "VARIANT_INVALID" });
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "SCHEMA_INVALID", path: ["board", "files"] }));
  });

  it("reports every independent semantic issue together", () => {
    const broken: VariantDefinition = {
      ...firstFlightVariant,
      setup: [
        ...firstFlightVariant.setup.filter(({ id }) => id !== "white-sovereign"),
        { id: "white-tower", typeId: "tower", ownerId: "white", at: { file: 4, rank: 4 } },
      ],
    };
    const result = importText(JSON.stringify(broken));

    expect(result).toMatchObject({ ok: false, code: "VARIANT_INVALID" });
    if (result.ok) return;
    expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining(["DUPLICATE_PIECE_ID", "OVERLAPPING_PIECES", "INVALID_ROYAL_COUNT"]));
    expect(result.issues.every(({ severity }) => severity === "error")).toBe(true);
  });

  it("rejects imported reach-target definitions with conflicting ownership and duplicate cells", () => {
    const objective = longWalkVariant.objectives[0];
    if (objective.type !== "reach-target") throw new Error("Expected reach-target fixture");
    const broken: VariantDefinition = {
      ...longWalkVariant,
      schemaVersion: 2,
      objectives: [{
        ...objective,
        targets: [
          objective.targets[0]!,
          {
            ...objective.targets[1]!,
            playerId: objective.targets[0]!.playerId,
            cells: [
              { ...objective.targets[1]!.cells[0]! },
              { ...objective.targets[1]!.cells[0]! },
            ],
          },
        ],
      }],
    };

    const result = importText(JSON.stringify(broken));

    expect(result).toMatchObject({ ok: false, code: "VARIANT_INVALID" });
    if (result.ok) return;
    expect(result.issues.map(({ code }) => code)).toEqual([
      "DUPLICATE_TARGET_PLAYER",
      "DUPLICATE_TARGET_CELL",
      "NO_TARGET",
    ]);
  });
});
