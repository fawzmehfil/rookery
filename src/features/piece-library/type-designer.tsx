"use client";

import { useState } from "react";
import { movementPatternSchema, type MovementFrame, type MovementMode, type MovementPattern, type PieceTypeDefinition } from "@rookery/rules";
import { duplicateMovement, movementSummary, symmetricalVectors, type Symmetry } from "./model";
import { MovementPreview } from "./movement-preview";
import styles from "./piece-library.module.css";

const numeric = (value: string) => value === "" ? NaN : Number(value);
const display = (value: number) => Number.isFinite(value) ? String(value) : "";

export function TypeDesigner({ type, onChange, token, onTokenChange, forwardRanks = [1,-1] }: {
  type: PieceTypeDefinition; onChange: (type: PieceTypeDefinition) => void; token: string; onTokenChange: (token: string) => void;
  forwardRanks?: readonly (1 | -1)[];
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [kind, setKind] = useState<"auto" | MovementPattern["kind"]>("auto");
  const [frame, setFrame] = useState<MovementFrame>("board");
  const [mode, setMode] = useState<MovementMode>("move-or-capture");
  const [symmetry, setSymmetry] = useState<Symmetry>("single");
  const [player, setPlayer] = useState(0);
  const [message, setMessage] = useState("Choose a destination on the mini-board to add movement.");
  const current = index === null ? undefined : type.movements[index];
  function update(rule: MovementPattern) {
    onChange({ ...type, movements: index === null ? [...type.movements, rule] : type.movements.map((m,i) => i === index ? rule : m) });
    if (index === null) setIndex(type.movements.length);
  }
  function choose(x: number, y: number) {
    if (player === 1 && (current?.frame ?? frame) === "owner") y *= forwardRanks[1] ?? -1;
    else if (player === 0 && (current?.frame ?? frame) === "owner") y *= forwardRanks[0] ?? 1;
    if (x === 0 && y === 0) { setMessage("The center is your piece. Choose a different cell; zero movement is not allowed."); return; }
    const chosenKind = current?.kind ?? (kind === "auto" ? Math.max(Math.abs(x), Math.abs(y)) === 1 ? "step" : "leap" : kind);
    if (chosenKind === "slide") { let a = Math.abs(x), b = Math.abs(y); while (b) [a,b] = [b,a%b]; x /= a; y /= a; }
    const extra = symmetricalVectors({ fileDelta: x, rankDelta: y }, symmetry);
    const old = current ? current.kind === "slide" ? current.directions : current.offsets : [];
    const vectors = [...old, ...extra];
    if (new Set(vectors.map(v => `${v.fileDelta},${v.rankDelta}`)).size !== vectors.length) { setMessage("That destination is already in this rule. Edit or remove its direction in Advanced instead."); return; }
    const rule = { kind: chosenKind, frame: current?.frame ?? frame, mode: current?.mode ?? mode,
      ...(chosenKind === "slide" ? { directions: vectors, ...(current?.kind === "slide" && current.maxDistance !== undefined ? { maxDistance: current.maxDistance } : {}) } : { offsets: vectors }) };
    const parsed = movementPatternSchema.safeParse(rule);
    if (!parsed.success) { setMessage(parsed.error.issues.map(i => i.message).join(" ")); return; }
    if (!current && type.movements.length >= 64) { setMessage("A piece supports at most 64 movement rules."); return; }
    update(parsed.data); setMessage("Movement updated. Preview, advanced controls and draft now match.");
  }
  const errors = type.movements.flatMap((m,i) => { const result = movementPatternSchema.safeParse(m); return result.success ? [] : result.error.issues.map(e => `Rule ${i+1}, ${e.path.join(".")}: ${e.message}`); });
  const duplicates = duplicateMovement(type);
  function patchSettings(patch: { frame?: MovementFrame; mode?: MovementMode }) { if (current) update({ ...current, ...patch }); }

  return <div className={styles.designer}>
    <div className={styles.identity}>
      <label>Piece name<input maxLength={80} value={type.name} onChange={e => onChange({ ...type, name: e.target.value })} /></label>
      <label>Display token<input maxLength={4} value={token} placeholder={type.name.slice(0,2) || "✦"} onChange={e => onTokenChange(e.target.value)} /></label>
      <label className={styles.checkbox}><input type="checkbox" checked={type.royal} onChange={e => onChange({ ...type, royal: e.target.checked })} />Royal piece</label>
    </div>
    <p className={styles.hint}>Tokens are display settings for this session. Name, royal status and movement are part of the saved variant.</p>
    <label>Rule to edit<select value={index ?? "new"} onChange={e => setIndex(e.target.value === "new" ? null : Number(e.target.value))}>
      {type.movements.map((m,i) => <option value={i} key={i}>Rule {i+1} · {m.kind}</option>)}<option value="new">+ New movement rule</option>
    </select></label>
    {!current && <label>Draw movement<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
      <option value="auto">One-time step or leap</option><option value="slide">Repeating slide / ray</option><option value="step">Adjacent step</option><option value="leap">Leap</option>
    </select></label>}
    <div className={styles.twoColumns}>
      <label>Direction frame<select value={current?.frame ?? frame} onChange={e => { const value = e.target.value as MovementFrame; setFrame(value); patchSettings({ frame: value }); }}><option value="board">Board-relative</option><option value="owner">Owner-relative</option></select></label>
      <label>Movement behavior<select value={current?.mode ?? mode} onChange={e => { const value = e.target.value as MovementMode; setMode(value); patchSettings({ mode: value }); }}><option value="move-or-capture">Move or capture</option><option value="move-only">Move only</option><option value="capture-only">Capture only</option></select></label>
    </div>
    <label>Symmetry shortcut<select value={symmetry} onChange={e => setSymmetry(e.target.value as Symmetry)}>
      <option value="single">Just this destination</option><option value="left-right">Mirror left / right</option><option value="forward-backward">Mirror forward / backward</option><option value="diagonals">Mirror diagonals</option><option value="rotations">Rotate four ways</option><option value="all">All orientations (including knight-like)</option>
    </select></label>
    <div className={styles.previewToolbar}><strong>Click a cell to draw</strong><label>Preview player<select value={player} onChange={e => setPlayer(Number(e.target.value))}><option value={0}>White / first player</option><option value={1}>Black / second player</option></select></label></div>
    <MovementPreview type={type} forwardRank={forwardRanks[player] ?? 1} label="Movement designer" onChoose={choose} />
    <p className={styles.hint}>Board-relative points the same way for both players. Owner-relative flips forward for the other player; left/right stays fixed. Dots show moves; corners show capture-only destinations. Preview window: four cells in each direction.</p>
    <p aria-live="polite" className={styles.notice}>{message}</p>
    <div className={styles.chips} role="group" aria-label="Movement rule chips">{type.movements.map((m,i) => <button key={i} aria-pressed={index === i} onClick={() => setIndex(i)}>{movementPatternSchema.safeParse(m).success ? movementSummary(m) : `Rule ${i+1} needs correction in Advanced`}</button>)}</div>
    {current && <button type="button" onClick={() => { onChange({ ...type, movements: type.movements.filter((_,i) => i !== index) }); setIndex(null); }}>Delete this rule</button>}
    <details className={styles.advanced}><summary>Advanced: edit movement vectors</summary>
      <p className={styles.hint}>Every change updates the same draft immediately. Invalid values stay editable and block playtest. Vector order is preserved.</p>
      {type.movements.map((m,i) => <fieldset key={i}><legend>Rule {i+1} · {m.kind}</legend>
        <label>Movement kind {i+1}<select value={m.kind} onChange={e => { const next = e.target.value as MovementPattern["kind"]; const vectors=m.kind === "slide" ? m.directions : m.offsets;
          onChange({ ...type, movements: type.movements.map((rule,j) => j !== i ? rule : next === "slide" ? {kind:next,frame:m.frame,mode:m.mode,directions:vectors} : {kind:next,frame:m.frame,mode:m.mode,offsets:vectors}) }); }}><option value="step">Step</option><option value="slide">Sliding</option><option value="leap">Leaping</option></select></label>
        <label>Frame for rule {i+1}<select value={m.frame} onChange={e => onChange({ ...type, movements: type.movements.map((rule,j) => j === i ? {...rule,frame:e.target.value as MovementFrame}:rule) })}><option value="board">Board-relative</option><option value="owner">Owner-relative</option></select></label>
        <label>Behavior for rule {i+1}<select value={m.mode} onChange={e => onChange({ ...type, movements: type.movements.map((rule,j) => j === i ? {...rule,mode:e.target.value as MovementMode}:rule) })}><option value="move-or-capture">Move or capture</option><option value="move-only">Move only</option><option value="capture-only">Capture only</option></select></label>
        {(m.kind === "slide" ? m.directions : m.offsets).map((v,k) => <div className={styles.vectorRow} key={k}>{(["fileDelta","rankDelta"] as const).map(axis => <label key={axis}>{axis === "fileDelta" ? "Across" : "Forward"} {i+1}.{k+1}<input type="number" min={m.kind === "step" ? -1 : -25} max={m.kind === "step" ? 1 : 25} step={1} value={display(v[axis])}
          onChange={e => { const vectors=(m.kind === "slide" ? m.directions : m.offsets).map((item,n) => n === k ? {...item,[axis]:numeric(e.target.value)}:item);
            onChange({...type,movements:type.movements.map((rule,j) => j !== i ? rule : m.kind === "slide" ? {...m,directions:vectors}:{...m,offsets:vectors})}); }} /></label>)}<button aria-label={`Remove vector ${i+1}.${k+1}`} onClick={() => {
          const vectors=(m.kind === "slide" ? m.directions:m.offsets).filter((_,n) => n !== k); onChange({...type,movements:type.movements.map((rule,j) => j !== i ? rule : m.kind === "slide" ? {...m,directions:vectors}:{...m,offsets:vectors})}); }}>×</button></div>)}
        {m.kind === "slide" && <label>Maximum distance {i+1} (empty means board edge)<input type="number" min={1} max={25} step={1} value={m.maxDistance === undefined ? "" : display(m.maxDistance)} onChange={e => {
          const { maxDistance: _distance, ...base } = m; void _distance;
          const rule: MovementPattern = e.target.value === "" ? base : {...m,maxDistance:Number(e.target.value)};
          onChange({...type,movements:type.movements.map((item,j) => j === i ? rule:item)});
        }} /></label>}
      </fieldset>)}
    </details>
    {(errors.length > 0 || duplicates || !type.movements.length || !type.name.trim()) && <div role="alert" className={styles.error}>{!type.name.trim()&&<p>Give this piece a name before adding or playtesting it.</p>}{errors.map((e,i)=><p key={i}>{e}</p>)}{duplicates && <p>{duplicates}</p>}{!type.movements.length && <p>Add at least one movement rule before playtesting.</p>}</div>}
  </div>;
}
