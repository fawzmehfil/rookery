"use client";

import { useEffect, useRef, useState } from "react";
import { pieceTypeDefinitionSchema, type PieceTemplate, type PieceTypeDefinition, type VariantDefinition } from "@rookery/rules";
import { EditorModal } from "./modal";
import { TypeDesigner } from "./type-designer";
import { MovementPreview } from "./movement-preview";
import { categories, duplicateMovement, searchTemplates, uniqueTypeId } from "./model";
import styles from "./piece-library.module.css";

export function PieceLibrary({ draft, onAdd, onClose }: { draft: VariantDefinition; onAdd: (type: PieceTypeDefinition, token: string) => void; onClose: () => void }) {
  const [query,setQuery]=useState(""); const [category,setCategory]=useState("recommended");
  const [template,setTemplate]=useState<PieceTemplate | null>(null);
  const [creating,setCreating]=useState<PieceTypeDefinition | null>(null); const [token,setToken]=useState("✦");
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => { if (template) detailRef.current?.focus(); }, [template]);
  const results=searchTemplates(query,category);
  function start(source?: PieceTemplate | PieceTypeDefinition) {
    const type = source && "defaultToken" in source ? { id:source.id,name:source.name,royal:source.defaultRoyal,movements:structuredClone(source.movements) }
      : source ? structuredClone(source) : {id:"custom",name:"",royal:false,movements:[]};
    setToken(source && "defaultToken" in source ? source.defaultToken : "✦"); setCreating(type);
  }
  function add(type: PieceTypeDefinition, chosenToken: string) { onAdd({...structuredClone(type), id: uniqueTypeId(type.id === "custom" ? type.name : type.id,draft.pieceTypes)},chosenToken); }
  return <EditorModal title={creating ? "Create your piece" : "Piece library"} onClose={onClose}>
    {creating ? <>
      <p className={styles.hint}>1 · Name & token → 2 · Draw movement → 3 · Review → 4 · Add & place</p>
      <TypeDesigner type={creating} onChange={setCreating} token={token} onTokenChange={setToken} forwardRanks={draft.players.map(p=>p.forwardRank)} />
      <div className={styles.actions}><button onClick={()=>setCreating(null)}>Back to library</button><button disabled={!pieceTypeDefinitionSchema.safeParse(creating).success || !!duplicateMovement(creating) || draft.pieceTypes.length >= 128} onClick={()=>add(creating,token)}>Add type and place copies</button></div>
    </> : <>
      <p>Find a familiar piece, discover something unusual, or invent your own.</p>
      <div className={styles.libraryToolbar}><label>Search pieces<input value={query} onChange={e=>{setQuery(e.target.value);setCategory("all");}} placeholder="Try Empress, diagonal, or three cells" /></label><button onClick={()=>start()}>Create a blank piece</button></div>
      <div className={styles.filters} role="group" aria-label="Piece categories"><button aria-pressed={category==="all"} onClick={()=>{setCategory("all");setTemplate(null);}}>All pieces</button>{categories.map(([value,label])=><button key={value} aria-pressed={category===value} onClick={()=>{setCategory(value);setTemplate(null);}}>{label}</button>)}</div>
      {template && <section ref={detailRef} tabIndex={-1} className={styles.templateDetail} aria-label={`${template.name} preview`}>
        <div><h3>{template.name}{template.aliases.length ? ` · ${template.aliases.join(", ")}`:""}</h3><p>{template.description}</p><p className={styles.hint}>Example: the highlighted cells are destinations from the center on an empty board. Pawn has separate forward moves and diagonal captures; first-move double steps, promotion and en passant are not included.</p><div className={styles.actions}><button onClick={()=>start(template)}>Customize {template.name}</button><button disabled={draft.pieceTypes.length>=128} onClick={()=>add({id:template.id,name:template.name,royal:template.defaultRoyal,movements:template.movements},template.defaultToken)}>Add {template.name}</button></div></div>
        <MovementPreview type={{id:template.id,name:template.name,royal:template.defaultRoyal,movements:template.movements}} label={`${template.name} enlarged movement diagram`} />
      </section>}
      <p role="status">{category==="custom" ? `${draft.pieceTypes.filter(t=>!searchTemplates("").some(p=>p.id===t.id)).length} custom pieces in this draft` : `${results.length} templates found`}</p>
      {category==="custom" ? <div className={styles.cards}>{draft.pieceTypes.filter(t=>!searchTemplates("").some(p=>p.id===t.id)).filter(t=>t.name.toLowerCase().includes(query.toLowerCase())).map(t=><article className={styles.card} key={t.id}><button onClick={()=>start(t)}><strong>{t.name}</strong> · Customize a copy</button><MovementPreview compact type={t} label={`${t.name} movement diagram`} /></article>)}</div>
      : results.length===0 ? <p>No pieces match. Try an alias, movement description, or another category.</p>
      : <div className={styles.cards}>{results.map(t=><article key={t.id} className={styles.card}><button onClick={()=>setTemplate(t)} aria-label={`Preview ${t.name}`}><span className={styles.token}>{t.defaultToken}</span> <strong>{t.name}</strong></button><span className={styles.aliases}>{t.aliases.join(" · ") || "Classic / fairy piece"}</span><p>{t.description}</p><MovementPreview compact type={{id:t.id,name:t.name,royal:t.defaultRoyal,movements:t.movements}} label={`${t.name} movement diagram`} /><span className={styles.tags}>{t.tags.join(" · ")}</span></article>)}</div>}
    </>}
  </EditorModal>;
}
