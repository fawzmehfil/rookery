import { expect, it } from "vitest";
import { parseVariantDefinition, validateVariantDefinition, type VariantDefinition } from "@rookery/rules";
import { firstFlightVariant, longWalkVariant, lastFlockStandingVariant } from "@rookery/rules/fixtures";
import { createLocalSession, resetLocalSession } from "@/features/local-playtest/local-session";
import { resizeBoard, setCellDisabled, playtestDraft } from "@/features/variant-editor/model";
import { defaultObjective, hasConfiguredTargets, objectiveIssues, setObjective, showcases, toggleTarget, updatePlayerTargets } from "./model";

it.each(showcases)("parses, validates, starts, resets and round trips $variant.name independently",({variant})=>{
  const before=JSON.stringify(variant);const clone:VariantDefinition=structuredClone(variant);
  expect(clone).not.toBe(variant);expect(clone.pieceTypes).not.toBe(variant.pieceTypes);
  expect(parseVariantDefinition(clone).ok).toBe(true);expect(validateVariantDefinition(clone).filter(i=>i.severity==="error")).toEqual([]);
  expect(objectiveIssues(clone)).toEqual([]);expect(JSON.stringify(JSON.parse(JSON.stringify(clone)))).toBe(before);
  const start=createLocalSession(clone);expect(start.ok).toBe(true);if(!start.ok)throw new Error("Showcase did not start");
  expect(resetLocalSession(start.value).state).toEqual(start.value.initialState);expect(JSON.stringify(variant)).toBe(before);
});
it("upgrades only when necessary and preserves board/setup/movement references",()=>{
  const unchanged=setObjective(firstFlightVariant,{type:"capture-royal"});expect(unchanged.schemaVersion).toBe(1);
  const reach=setObjective(firstFlightVariant,defaultObjective("reach-target",firstFlightVariant));
  expect(reach.schemaVersion).toBe(2);expect(reach.objectives).toEqual([{type:"reach-target",requireAction:true,targets:[{playerId:"white",cells:[]},{playerId:"black",cells:[]}]}]);
  for(const field of ["board","players","pieceTypes","setup","turnOrder"] as const)expect(reach[field]).toBe(firstFlightVariant[field]);
  expect(hasConfiguredTargets(reach)).toBe(false);expect(hasConfiguredTargets(longWalkVariant)).toBe(true);
  expect(setObjective(reach,{type:"eliminate-all"}).objectives).toEqual([{type:"eliminate-all"}]);
});
it("adds/removes per-player targets and preserves the other player's data",()=>{
  const result=toggleTarget(longWalkVariant,"white",{file:1,rank:2});if(!result.ok)throw new Error(result.message);
  const o=result.value.objectives[0];if(o.type!=="reach-target")throw new Error("wrong objective");
  expect(o.targets[0].cells).toEqual([{file:0,rank:2},{file:1,rank:2}]);
  expect(o.targets[1]).toBe(longWalkVariant.objectives[0].type==="reach-target"?longWalkVariant.objectives[0].targets[1]:undefined);
  expect(toggleTarget(result.value,"white",{file:1,rank:2})).toEqual({ok:true,value:longWalkVariant});
  expect(toggleTarget(longWalkVariant,"unknown",{file:0,rank:0}).ok).toBe(false);
});
it("rejects resize and disabling targets before modifying domain data",()=>{
  expect(resizeBoard(longWalkVariant,3,2,true)).toMatchObject({ok:false,message:expect.stringContaining("target")});
  expect(setCellDisabled(longWalkVariant,{file:0,rank:2},true)).toMatchObject({ok:false,message:expect.stringContaining("target")});
  expect(longWalkVariant.board.ranks).toBe(3);expect(longWalkVariant.board.disabledCells).toEqual([]);
});
it.each([
  ["SCHEMA_INVALID",{playerId:"white",cells:[]}],
  ["TARGET_OUT_OF_BOUNDS",{playerId:"white",cells:[{file:8,rank:0}]}],
  ["DUPLICATE_TARGET_CELL",{playerId:"white",cells:[{file:0,rank:2},{file:0,rank:2}]}],
  ["UNKNOWN_ELIGIBLE_PIECE_TYPE",{playerId:"white",cells:[{file:0,rank:2}],eligiblePieceTypeIds:["unknown"]}],
  ["SCHEMA_INVALID",{playerId:"white",cells:[{file:0,rank:2}],eligiblePieceTypeIds:[]}],
  ["NO_ELIGIBLE_PIECES",{playerId:"white",cells:[{file:0,rank:2}],eligiblePieceTypeIds:["unknown"]}],
] as const)("reports %s with a specific objective path and blocks handoff",(code,target)=>{
  const changed=updatePlayerTargets(longWalkVariant,target);expect(objectiveIssues(changed)).toContainEqual(expect.objectContaining({code,path:expect.arrayContaining(["objectives",0,"targets",0])}));expect(playtestDraft(changed)).toBeNull();
});
it("reports disabled cells, unknown players, duplicate owners and empty elimination sides",()=>{
  const disabled={...longWalkVariant,board:{...longWalkVariant.board,disabledCells:[{file:0,rank:2}]}};
  expect(objectiveIssues(disabled).map(i=>i.code)).toContain("TARGET_DISABLED");
  const o=longWalkVariant.objectives[0];if(o.type!=="reach-target")throw new Error("wrong fixture");
  expect(objectiveIssues(setObjective(longWalkVariant,{...o,targets:[{...o.targets[0],playerId:"missing"},o.targets[1]]})).map(i=>i.code)).toContain("UNKNOWN_TARGET_PLAYER");
  expect(objectiveIssues(setObjective(longWalkVariant,{...o,targets:[o.targets[0],o.targets[0]]})).map(i=>i.code)).toContain("DUPLICATE_TARGET_PLAYER");
  expect(objectiveIssues({...lastFlockStandingVariant,setup:lastFlockStandingVariant.setup.filter(p=>p.ownerId==="white")})).toContainEqual(expect.objectContaining({code:"NO_INITIAL_PIECES",path:["players",1]}));
});
