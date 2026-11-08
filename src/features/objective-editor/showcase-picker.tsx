"use client";
import { useState } from "react";
import type { VariantDefinition } from "@rookery/rules";
import { ConfirmChange } from "./confirmation";
import { objectiveChoices, showcases } from "./model";
import styles from "./objective-editor.module.css";

export function ShowcasePicker({draft,onLoad}:{draft:VariantDefinition;onLoad:(v:VariantDefinition)=>void}){
  const [loaded,setLoaded]=useState(()=>showcases.some(s=>JSON.stringify(s.variant)===JSON.stringify(draft))?JSON.stringify(draft):"");const [pending,setPending]=useState<VariantDefinition|null>(null);const [message,setMessage]=useState("");
  function load(v:VariantDefinition){const copy=structuredClone(v);setLoaded(JSON.stringify(copy));onLoad(copy);setPending(null);setMessage(`${copy.name} loaded as an independent editable draft.`);}
  return <section className={styles.showcases} aria-labelledby="showcases-heading"><div><p className={styles.eyebrow}>Choose your starting point</p><h2 id="showcases-heading">A few rules worth breaking.</h2><p className={styles.help}>Local examples to customize. Loading one replaces the current draft.</p></div>
    <div className={styles.showcaseCards}>{showcases.map(({variant,description})=><article key={variant.id}><h3>{variant.name}</h3><p>{description}</p><span>{variant.board.files} × {variant.board.ranks} · {objectiveChoices.find(o=>o.type===variant.objectives[0]?.type)?.name}</span><p className={styles.help}>Pieces: {variant.pieceTypes.map(t=>t.name).join(", ")}</p><button onClick={()=>JSON.stringify(draft)!==loaded?setPending(variant):load(variant)}>Load {variant.name}</button></article>)}</div>
    {pending && <ConfirmChange message={`Replace your edited draft with ${pending.name}? The current board, pieces, movement and objective configuration will be replaced.`} confirmLabel={`Confirm load ${pending.name}`} onCancel={()=>setPending(null)} onConfirm={()=>load(pending)} />}
    <p aria-live="polite" className={styles.help}>{message}</p>
  </section>;
}
