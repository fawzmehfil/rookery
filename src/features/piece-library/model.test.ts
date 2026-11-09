import { expect, it } from "vitest";
import { getPieceTemplate, parseVariantDefinition, pieceTemplateCatalog, validateVariantDefinition } from "@rookery/rules";
import { firstFlightVariant as draft } from "@rookery/rules/fixtures";
import { addType, duplicateMovement, previewTargets, removeType, searchTemplates, symmetricalVectors, uniqueTypeId } from "./model";

it.each([["Empress","chancellor"],["rook","tower"],["two cells diagonally","alfil"],["one cell horizontally","wazir"]])("searches %s through names, aliases and descriptions",(query,id)=>{
  expect(searchTemplates(query).some(t=>t.id===id)).toBe(true);
});
it("filters all groups, empty queries and missing results",()=>{
  expect(searchTemplates("")).toHaveLength(pieceTemplateCatalog.length);
  expect(searchTemplates("","recommended").map(t=>t.id)).toEqual(["chancellor","archbishop","amazon","camel","zebra","nightrider"]);
  expect(searchTemplates("","standard")).toHaveLength(6);
  expect(searchTemplates("","rider")[0].id).toBe("nightrider");
  expect(searchTemplates("unfindable")).toEqual([]);
});
it("copies templates deeply with collision-free stable IDs and never changes the catalog",()=>{
  const template=getPieceTemplate("tower")!; const before=JSON.stringify(template);
  const type={id:template.id,name:template.name,royal:false,movements:template.movements};
  const next=addType(draft,type); expect(next.pieceTypes.at(-1)?.id).toBe("tower-2");
  expect(next.pieceTypes.at(-1)?.movements).not.toBe(template.movements);
  expect(addType(next,type).pieceTypes.at(-1)?.id).toBe("tower-3");
  expect(uniqueTypeId("🦄 Unicorn",draft.pieceTypes)).toBe("unicorn");
  expect(JSON.stringify(template)).toBe(before);
  expect(parseVariantDefinition(next).ok).toBe(true);
  expect(validateVariantDefinition(next).filter(i=>i.severity==="error")).toEqual([]);
  expect(removeType(next,"tower-2")).toEqual(draft);
  const removed=removeType(draft,"tower");expect(removed.setup.some(p=>p.typeId==="tower")).toBe(false);
  expect(draft.setup).toHaveLength(6);
});
it("generates symmetry without duplicates and preserves predictable vector order",()=>{
  expect(symmetricalVectors({fileDelta:1,rankDelta:2},"all")).toHaveLength(8);
  expect(symmetricalVectors({fileDelta:1,rankDelta:1},"all")).toHaveLength(4);
  expect(symmetricalVectors({fileDelta:0,rankDelta:1},"left-right")).toEqual([{fileDelta:0,rankDelta:1}]);
  expect(symmetricalVectors({fileDelta:1,rankDelta:2},"forward-backward")).toEqual([{fileDelta:1,rankDelta:2},{fileDelta:1,rankDelta:-2}]);
});
it.each(["tower","bishop","queen","chancellor","camel","nightrider","pawn"])("uses public engine geometry for %s diagrams",id=>{
  const t=getPieceTemplate(id)!; const type={id:t.id,name:t.name,royal:t.defaultRoyal,movements:t.movements};
  const targets=previewTargets(type,1); expect(targets.moves.length+targets.captures.length).toBeGreaterThan(0);
  if(id==="bishop") {expect(targets.moves).toContain("f6");expect(targets.moves).not.toContain("e6");}
  if(id==="pawn") {expect(targets.moves).toEqual(["e6"]);expect(targets.captures).toEqual(["d6","f6"]);
    expect(previewTargets(type,-1).moves).toEqual(["e4"]);expect(previewTargets(type,-1).captures).toEqual(["d4","f4"]);}
});
it("identifies duplicates without normalizing or reordering exact source vectors",()=>{
  const m={kind:"step" as const,frame:"board" as const,mode:"move-only" as const,offsets:[{fileDelta:1,rankDelta:0},{fileDelta:1,rankDelta:0}]};
  expect(duplicateMovement({id:"test",name:"Test",royal:false,movements:[m]})).toContain("Duplicate");
});
