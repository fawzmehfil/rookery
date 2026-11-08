import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createPieceTypeFromTemplate,
  getPieceTemplate,
  parseVariantDefinition,
  pieceTemplateCatalog,
  pieceTypeDefinitionSchema,
  type MovementPattern,
  type PieceTemplate,
  type PieceTemplateId,
} from "./index";

const orthogonal = "-1,0|0,-1|0,1|1,0";
const diagonal = "-1,-1|-1,1|1,-1|1,1";
const adjacent = "-1,-1|-1,0|-1,1|0,-1|0,1|1,-1|1,0|1,1";
const knight = "-2,-1|-2,1|-1,-2|-1,2|1,-2|1,2|2,-1|2,1";
const alfil = "-2,-2|-2,2|2,-2|2,2";
const dabbaba = "-2,0|0,-2|0,2|2,0";
const camel = "-3,-1|-3,1|-1,-3|-1,3|1,-3|1,3|3,-1|3,1";
const zebra = "-3,-2|-3,2|-2,-3|-2,3|2,-3|2,3|3,-2|3,2";

const expectedPatterns: Readonly<Record<PieceTemplateId, readonly string[]>> = {
  sovereign: [`step:board:move-or-capture:${adjacent}`],
  tower: [`slide:board:move-or-capture:${orthogonal}`],
  bishop: [`slide:board:move-or-capture:${diagonal}`],
  queen: [`slide:board:move-or-capture:${adjacent}`],
  hopper: [`leap:board:move-or-capture:${knight}`],
  pawn: [
    "step:owner:move-only:0,1",
    "step:owner:capture-only:-1,1|1,1",
  ],
  chancellor: [
    `slide:board:move-or-capture:${orthogonal}`,
    `leap:board:move-or-capture:${knight}`,
  ],
  archbishop: [
    `slide:board:move-or-capture:${diagonal}`,
    `leap:board:move-or-capture:${knight}`,
  ],
  amazon: [
    `slide:board:move-or-capture:${adjacent}`,
    `leap:board:move-or-capture:${knight}`,
  ],
  centaur: [
    `step:board:move-or-capture:${adjacent}`,
    `leap:board:move-or-capture:${knight}`,
  ],
  wazir: [`step:board:move-or-capture:${orthogonal}`],
  ferz: [`step:board:move-or-capture:${diagonal}`],
  alfil: [`leap:board:move-or-capture:${alfil}`],
  dabbaba: [`leap:board:move-or-capture:${dabbaba}`],
  camel: [`leap:board:move-or-capture:${camel}`],
  zebra: [`leap:board:move-or-capture:${zebra}`],
  nightrider: [`slide:board:move-or-capture:${knight}`],
};

describe("piece template catalog", () => {
  it("exports the complete catalog in stable order", () => {
    expect(pieceTemplateCatalog.map(({ id }) => id)).toEqual(Object.keys(expectedPatterns));
    expectTypeOf(pieceTemplateCatalog).toMatchTypeOf<readonly PieceTemplate[]>();
  });

  it("defines exact, schema-valid movement data for every template", () => {
    for (const template of pieceTemplateCatalog) {
      expect(template.movements.map(patternSignature)).toEqual(expectedPatterns[template.id]);
      expect(pieceTypeDefinitionSchema.safeParse({
        id: template.id,
        name: template.name,
        royal: template.defaultRoyal,
        movements: template.movements,
      }).success).toBe(true);
    }
  });

  it("provides unique aliases and complete discovery metadata", () => {
    const names = new Set<string>();

    for (const template of pieceTemplateCatalog) {
      expect(template.description.length).toBeGreaterThan(10);
      expect(template.tags.length).toBeGreaterThan(0);
      expect(template.defaultToken.length).toBeGreaterThan(0);

      for (const name of [template.name, ...template.aliases]) {
        const normalized = name.toLocaleLowerCase();
        expect(names.has(normalized)).toBe(false);
        names.add(normalized);
      }
    }

    expect(getPieceTemplate("chancellor")?.aliases).toEqual(["Empress", "Marshal"]);
    expect(getPieceTemplate("archbishop")?.aliases).toEqual(["Cardinal", "Princess"]);
    expect(getPieceTemplate("centaur")?.aliases).toEqual(["General"]);
    expect(getPieceTemplate("missing")).toBeUndefined();
  });

  it("marks the planned first catalog presentation as recommended", () => {
    expect(
      pieceTemplateCatalog.filter(({ tags }) => tags.includes("recommended")).map(({ id }) => id),
    ).toEqual(["chancellor", "archbishop", "amazon", "camel", "zebra", "nightrider"]);
  });

  it("copies templates without sharing mutable data", () => {
    const first = createPieceTypeFromTemplate("chancellor", { id: "custom-one" });
    const second = createPieceTypeFromTemplate("chancellor", {
      id: "custom-two",
      name: "Royal Marshal",
      royal: true,
    });

    expect(first).toMatchObject({ id: "custom-one", name: "Chancellor", royal: false });
    expect(second).toMatchObject({ id: "custom-two", name: "Royal Marshal", royal: true });
    expect(first.movements).toEqual(second.movements);
    expect(first.movements).not.toBe(second.movements);
    expect(first.movements[0]).not.toBe(second.movements[0]);
    expect(Object.isFrozen(pieceTemplateCatalog)).toBe(true);
    expect(Object.isFrozen(getPieceTemplate("chancellor")?.movements)).toBe(true);
    expect(Object.isFrozen(first.movements)).toBe(true);
  });

  it("validates caller-provided IDs and names at the factory boundary", () => {
    expect(() => createPieceTypeFromTemplate("camel", { id: "Not Valid" })).toThrow();
    expect(() => createPieceTypeFromTemplate("camel", { id: "camel-copy", name: "" })).toThrow();
  });

  it("produces piece types that serialize as ordinary variant data", () => {
    const sovereign = createPieceTypeFromTemplate("sovereign", { id: "royal" });
    const source = {
      schemaVersion: 2,
      id: "catalog-contract",
      name: "Catalog contract",
      board: { files: 3, ranks: 3, disabledCells: [] },
      players: [
        { id: "white", name: "White", forwardRank: 1 },
        { id: "black", name: "Black", forwardRank: -1 },
      ],
      turnOrder: ["white", "black"],
      pieceTypes: [sovereign],
      setup: [
        { id: "white-royal", typeId: "royal", ownerId: "white", at: { file: 0, rank: 0 } },
        { id: "black-royal", typeId: "royal", ownerId: "black", at: { file: 2, rank: 2 } },
      ],
      objectives: [{ type: "capture-royal" }],
    };

    expect(parseVariantDefinition(JSON.parse(JSON.stringify(source))).ok).toBe(true);
  });
});

function patternSignature(pattern: MovementPattern): string {
  const vectors = pattern.kind === "slide" ? pattern.directions : pattern.offsets;
  return `${pattern.kind}:${pattern.frame}:${pattern.mode}:${vectors
    .map(({ fileDelta, rankDelta }) => `${fileDelta},${rankDelta}`)
    .join("|")}`;
}
