import {
  coordinateToSquare,
  coordinateSchema,
  validateVariantDefinition,
  type Coordinate,
  type ObjectiveDefinition,
  type ReachTargetPlayerTargets,
  type ValidationIssue,
  type VariantDefinition,
} from "@rookery/rules";
import { firstFlightVariant, longWalkVariant, lastFlockStandingVariant } from "@rookery/rules/fixtures";

export const objectiveChoices = [
  {type:"capture-royal",name:"Capture the royal",description:"Win by capturing the opponent's royal piece."},
  {type:"reach-target",name:"Reach a target",description:"Win by moving an eligible piece onto one of your target cells."},
  {type:"eliminate-all",name:"Eliminate all opponents",description:"Win by capturing the opponent's final piece."},
] as const;
export const showcases = [
  {variant:firstFlightVariant,description:"A small first game: learn steps, slides and leaps while capturing the royal."},
  {variant:longWalkVariant,description:"A race with owner-relative runners and mirrored targets. White's winning idea is a1 → a2 → a3."},
  {variant:lastFlockStandingVariant,description:"A compact elimination game featuring Chancellor, Camel and Nightrider."},
] as const;
export function formatCell(at: Coordinate) { return coordinateSchema.safeParse(at).success ? coordinateToSquare(at) : `(${at.file}, ${at.rank})`; }
const sameCell=(a:Coordinate,b:Coordinate)=>a.file===b.file && a.rank===b.rank;
export function setObjective(v:VariantDefinition, objective:ObjectiveDefinition):VariantDefinition {
  if(v.schemaVersion===1 && objective.type==="capture-royal") return {...v,objectives:[objective]};
  return {...v,schemaVersion:2,objectives:[objective]};
}
export function defaultObjective(type:ObjectiveDefinition["type"],v:VariantDefinition):ObjectiveDefinition {
  return type==="reach-target" ? {type,requireAction:true,targets:v.players.map(p=>({playerId:p.id,cells:[]}))} : {type};
}
export function hasConfiguredTargets(v:VariantDefinition) { const o=v.objectives[0];return o?.type==="reach-target" && o.targets.some(t=>t.cells.length>0 || t.eligiblePieceTypeIds!==undefined); }
export function updatePlayerTargets(v:VariantDefinition, target:ReachTargetPlayerTargets):VariantDefinition {
  const o=v.objectives[0]; if(o?.type!=="reach-target") return v;
  const exists=o.targets.some(t=>t.playerId===target.playerId);
  return setObjective(v,{...o,targets:exists ? o.targets.map(t=>t.playerId===target.playerId?target:t):[...o.targets,target]});
}
export function targetCellError(v:VariantDefinition,at:Coordinate):string|null {
  if(!coordinateSchema.safeParse(at).success || at.file>=v.board.files || at.rank>=v.board.ranks) return "Choose a target inside the current board.";
  if(v.board.disabledCells.some(cell=>sameCell(cell,at))) return "Enable this cell before choosing it as a target.";
  return null;
}
export function toggleTarget(v:VariantDefinition,playerId:string,at:Coordinate):{ok:true;value:VariantDefinition}|{ok:false;message:string} {
  const o=v.objectives[0];if(o?.type!=="reach-target" || !v.players.some(p=>p.id===playerId)) return {ok:false,message:"Choose a defined player and the Reach a target objective first."};
  const target=o.targets.find(t=>t.playerId===playerId)??{playerId,cells:[]};
  if(target.cells.some(c=>sameCell(c,at))) return {ok:true,value:updatePlayerTargets(v,{...target,cells:target.cells.filter(c=>!sameCell(c,at))})};
  const error=targetCellError(v,at);if(error) return {ok:false,message:error};
  return {ok:true,value:updatePlayerTargets(v,{...target,cells:[...target.cells,{...at}]})};
}
export function targetResizeError(v:VariantDefinition,files:number,ranks:number):string|null {
  const o=v.objectives[0];if(o?.type!=="reach-target") return null;
  const affected=o.targets.flatMap(t=>t.cells).filter(at=>at.file>=files||at.rank>=ranks);
  return affected.length ? `Move or remove target ${affected.map(formatCell).join(", ")} in Objective settings before shrinking the board.`:null;
}
export function isTarget(v:VariantDefinition,at:Coordinate) { const o=v.objectives[0];return o?.type==="reach-target" && o.targets.some(t=>t.cells.some(c=>sameCell(c,at))); }
const objectivePlayerCodes = new Set(["NO_TARGET", "NO_INITIAL_PIECES", "PIECE_INITIALIZED_ON_TARGET"]);

/** Objective-panel projection of the shared validator; the editor does not
 * maintain a second set of objective semantics. */
export function objectiveIssues(v: VariantDefinition): ValidationIssue[] {
  return validateVariantDefinition(v).filter(
    (issue) => issue.path[0] === "objectives" || objectivePlayerCodes.has(issue.code),
  );
}
