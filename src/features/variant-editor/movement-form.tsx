"use client";

import { useState, type FormEvent } from "react";
import { movementPatternSchema, type MovementPattern } from "@rookery/rules";
import styles from "./variant-editor.module.css";

export function movementDescription(rule: MovementPattern) {
  const vectors = rule.kind === "slide" ? rule.directions : rule.offsets;
  const vectorText = vectors.map(v => `${v.fileDelta} across, ${v.rankDelta} forward`).join("; ");
  return `${rule.kind === "slide" ? "Slide" : rule.kind === "leap" ? "Leap" : "Step"}: ${vectorText}. ${rule.frame === "owner" ? "Forward follows the owner's direction" : "Forward means increasing board rank"}. ${rule.mode.replaceAll("-", " ")}${rule.kind === "slide" ? `; up to ${rule.maxDistance ?? "the board edge"}${rule.maxDistance ? " cells" : ""}, stopping at blockers` : rule.kind === "leap" ? "; jumps over intervening cells" : ""}.`;
}

export function MovementForm({ initial, onSave }: { initial?: MovementPattern; onSave: (rule: MovementPattern) => void }) {
  const [kind, setKind] = useState<MovementPattern["kind"]>(initial?.kind ?? "step");
  const [frame, setFrame] = useState(initial?.frame ?? "board");
  const [mode, setMode] = useState(initial?.mode ?? "move-or-capture");
  const initialVectors = initial ? initial.kind === "slide" ? initial.directions : initial.offsets : [{ fileDelta: 0, rankDelta: 1 }];
  const [vectors, setVectors] = useState(initialVectors.map(v => ({ file: String(v.fileDelta), rank: String(v.rankDelta) })));
  const [distance, setDistance] = useState(initial?.kind === "slide" && initial.maxDistance ? String(initial.maxDistance) : "");
  const [errors, setErrors] = useState<readonly { path: string; message: string }[]>([]);
  const limit = kind === "step" ? 1 : 25;
  const maxVectors = kind === "step" ? 8 : kind === "slide" ? 16 : 64;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (vectors.some(v => v.file.trim() === "" || v.rank.trim() === "")) {
      setErrors([{ path: "vectors", message: "Complete both numbers for every direction." }]); return;
    }
    const offsets = vectors.map(v => ({ fileDelta: Number(v.file), rankDelta: Number(v.rank) }));
    const result = movementPatternSchema.safeParse({ kind, frame, mode,
      ...(kind === "slide" ? { directions: offsets, ...(distance.trim() ? { maxDistance: Number(distance) } : {}) } : { offsets }) });
    if (!result.success) {
      setErrors(result.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }))); return;
    }
    setErrors([]); onSave(result.data);
  }

  return <form onSubmit={submit} noValidate aria-label="Movement rule form" className={styles.ruleForm}>
    <div className={styles.fieldRow}>
      <label>Movement kind<select value={kind} onChange={e => setKind(e.target.value as MovementPattern["kind"])}>
        <option value="step">Step · adjacent cells</option><option value="slide">Sliding · follow a direction</option><option value="leap">Leaping · jump to an offset</option>
      </select></label>
      <label>Direction frame<select value={frame} onChange={e => setFrame(e.target.value as typeof frame)}>
        <option value="board">Board-relative</option><option value="owner">Owner-relative</option>
      </select></label>
    </div>
    <label>Movement behavior<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
      <option value="move-or-capture">Move or capture</option><option value="move-only">Move only</option><option value="capture-only">Capture only</option>
    </select></label>
    <p className={styles.help} id="vector-help">Positive across goes right. Positive forward increases board rank, or follows the owner in an owner-relative rule. Both numbers cannot be zero. {kind === "slide" ? "Use a direction in its smallest whole-number form, such as 1, 1 rather than 2, 2." : ""}</p>
    {vectors.map((v, i) => <fieldset key={i} className={styles.vector}>
      <legend>{kind === "slide" ? "Direction" : "Offset"} {i + 1}</legend>
      <label>Across {i + 1}<input type="number" min={-limit} max={limit} step="1" value={v.file} aria-describedby="vector-help movement-errors"
        onChange={e => setVectors(vectors.map((item, j) => j === i ? { ...item, file: e.target.value } : item))} /></label>
      <label>Forward {i + 1}<input type="number" min={-limit} max={limit} step="1" value={v.rank} aria-describedby="vector-help movement-errors"
        onChange={e => setVectors(vectors.map((item, j) => j === i ? { ...item, rank: e.target.value } : item))} /></label>
      <button type="button" disabled={vectors.length === 1} aria-label={`Remove direction ${i + 1}`} onClick={() => setVectors(vectors.filter((_, j) => j !== i))}>Remove</button>
    </fieldset>)}
    <button type="button" disabled={vectors.length >= maxVectors} onClick={() => setVectors([...vectors, { file: "0", rank: "1" }])}>Add direction</button>
    {kind === "slide" && <label>Maximum distance (1–25; empty means board edge)<input type="number" min="1" max="25" step="1" value={distance} onChange={e => setDistance(e.target.value)} aria-describedby="movement-errors" /></label>}
    <div id="movement-errors" role={errors.length ? "alert" : undefined}>{errors.map((e, i) => <p className={styles.error} key={i}>{e.path}: {e.message}</p>)}</div>
    <button className={styles.primary} type="submit">{initial ? "Save movement rule" : "Add movement rule"}</button>
  </form>;
}
