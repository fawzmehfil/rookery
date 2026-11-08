"use client";
import { useState } from "react";
import { squareToCoordinate, type ObjectiveDefinition, type VariantDefinition } from "@rookery/rules";
import { ConfirmChange } from "./confirmation";
import { defaultObjective, formatCell, hasConfiguredTargets, objectiveChoices, objectiveIssues, setObjective, targetCellError, toggleTarget, updatePlayerTargets } from "./model";
import styles from "./objective-editor.module.css";

export function ObjectiveEditor({draft,onChange,targetPlayer,onTargetPlayerChange}:{draft:VariantDefinition;onChange:(v:VariantDefinition)=>void;targetPlayer:string|null;onTargetPlayerChange:(id:string|null)=>void}){
  const [pending,setPending]=useState<ObjectiveDefinition["type"]|null>(null);
  const [coordinates,setCoordinates]=useState<Record<string,string>>({});const [feedback,setFeedback]=useState("");
  const objective=draft.objectives[0];const issues=objectiveIssues(draft);
  function choose(type:ObjectiveDefinition["type"]){
    if(type===objective?.type)return;
    if(hasConfiguredTargets(draft)){setPending(type);return;}
    onChange(setObjective(draft,defaultObjective(type,draft)));onTargetPlayerChange(null);
  }
  return <section className={styles.objectivePanel} aria-labelledby="objectives-heading" id="objective-panel">
    <p className={styles.eyebrow}>The finish line</p><h2 id="objectives-heading">How do you win?</h2>
    <div className={styles.objectiveCards} role="group" aria-label="Choose one objective">{objectiveChoices.map(choice=><button key={choice.type} aria-label={choice.name} aria-describedby={`objective-description-${choice.type}`} aria-pressed={objective?.type===choice.type} onClick={()=>choose(choice.type)}><strong>{choice.name}</strong><span id={`objective-description-${choice.type}`}>{choice.description}</span></button>)}</div>
    {pending && <ConfirmChange message="Switching objectives will discard the configured targets and eligible-piece settings. Board, pieces and movement will stay intact." confirmLabel="Confirm objective switch" onCancel={()=>setPending(null)} onConfirm={()=>{onChange(setObjective(draft,defaultObjective(pending,draft)));onTargetPlayerChange(null);setPending(null);}} />}
    {objective?.type==="capture-royal" && <p className={styles.help}>Each player needs exactly one placed royal piece. Mark the appropriate <a href="#movement-panel">piece type as royal in Movement rules</a>. This objective uses capture, not check or checkmate.</p>}
    {objective?.type==="eliminate-all" && <p className={styles.help}>Capture the opponent&apos;s final piece to win. Both players must begin with at least one piece; royal designation has no special effect on this objective.</p>}
    {objective?.type!=="capture-royal" && <p className={styles.help}>You can configure this objective and playtest movement. Automatic victory checking for this objective is not available in this build yet.</p>}
    {objective?.type==="reach-target" && <>
      <p className={styles.help}>Starting on a target does not win. An eligible piece must complete an accepted move onto its own player&apos;s target. Board-selection mode edits targets instead of moving or placing pieces.</p>
      <div className={styles.targetColumns}>{draft.players.map((player,playerIndex)=>{
        const target=objective.targets.find(t=>t.playerId===player.id)??{playerId:player.id,cells:[]};
        return <section className={styles.playerTargets} key={player.id} data-player={playerIndex} aria-label={`${player.name} targets`}>
          <h3>{player.name}&apos;s targets</h3>
          <button aria-pressed={targetPlayer===player.id} onClick={()=>onTargetPlayerChange(targetPlayer===player.id?null:player.id)}>{targetPlayer===player.id?`Finish selecting ${player.name} targets`:`Select ${player.name} targets on board`}</button>
          <div className={styles.targetChips}>{target.cells.map((at,i)=><button key={i} aria-label={`Remove ${player.name} target ${formatCell(at)}`} onClick={()=>onChange(updatePlayerTargets(draft,{...target,cells:target.cells.filter((_,j)=>j!==i)}))}>{formatCell(at)} ×</button>)}{!target.cells.length&&<span>No targets yet</span>}</div>
          <form onSubmit={e=>{e.preventDefault();const at=squareToCoordinate(coordinates[player.id]??"");if(!at){setFeedback("Enter a coordinate from a1 to z26, such as a3.");return;}const error=targetCellError(draft,at);if(error){setFeedback(error);return;}if(target.cells.some(c=>c.file===at.file&&c.rank===at.rank)){setFeedback(`${formatCell(at)} is already a target for ${player.name}.`);return;}const result=toggleTarget(draft,player.id,at);if(result.ok){onChange(result.value);setFeedback(`${formatCell(at)} added for ${player.name}.`);}else setFeedback(result.message);}}>
            <label>{player.name} target coordinate<input value={coordinates[player.id]??""} maxLength={3} placeholder="a3" onChange={e=>setCoordinates({...coordinates,[player.id]:e.target.value})} aria-describedby="target-feedback" /></label><button type="submit">Add {player.name} target</button>
          </form>
          <label className={styles.checkbox}><input type="checkbox" checked={target.eligiblePieceTypeIds===undefined} onChange={e=>{
            if(e.target.checked){onChange(updatePlayerTargets(draft,{playerId:target.playerId,cells:target.cells}));}
            else onChange(updatePlayerTargets(draft,{...target,eligiblePieceTypeIds:[]}));
          }} />Any {player.name} piece can reach a target</label>
          {target.eligiblePieceTypeIds!==undefined && <fieldset><legend>Eligible {player.name} piece types</legend>{draft.pieceTypes.map(type=><label className={styles.checkbox} key={type.id}><input type="checkbox" checked={target.eligiblePieceTypeIds?.includes(type.id)??false} onChange={e=>onChange(updatePlayerTargets(draft,{...target,eligiblePieceTypeIds:e.target.checked?[...(target.eligiblePieceTypeIds??[]),type.id]:(target.eligiblePieceTypeIds??[]).filter(id=>id!==type.id)}))} />{type.name}</label>)}{target.eligiblePieceTypeIds.filter(id=>!draft.pieceTypes.some(t=>t.id===id)).map(id=><button key={id} onClick={()=>onChange(updatePlayerTargets(draft,{...target,eligiblePieceTypeIds:target.eligiblePieceTypeIds?.filter(value=>value!==id)}))}>Remove unknown type {id}</button>)}</fieldset>}
          {issues.filter(issue=>issue.path[3]===objective.targets.indexOf(target)).map((issue,i)=><p key={i} className={styles.error}>{issue.path.join(".")}: {issue.message}</p>)}
        </section>;
      })}</div>
      {objective.targets.map((t,i)=>!draft.players.some(p=>p.id===t.playerId)?<p key={i} className={styles.error}>Unknown target owner {t.playerId}. <button onClick={()=>onChange(setObjective(draft,{...objective,targets:objective.targets.filter((_,j)=>j!==i)}))}>Remove unknown target configuration</button></p>:null)}
    </>}
    <p id="target-feedback" aria-live="polite" className={styles.help}>{feedback}</p>
    {targetPlayer && <p className={styles.selectionBanner}>Editing targets for {draft.players.find(p=>p.id===targetPlayer)?.name}. Activate cells on the main board to add or remove them.</p>}
  </section>;
}
