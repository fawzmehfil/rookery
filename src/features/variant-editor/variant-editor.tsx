"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { coordinateToSquare, squareToCoordinate, validateVariantDefinition, type Coordinate, type VariantDefinition } from "@rookery/rules";
import { firstFlightVariant } from "@rookery/rules/fixtures";
import { BoardSurface } from "@/components/board-surface";
import rookeryLogo from "../../../assets/rookery.png";
import { editorBoardPieces } from "./board-adapter";
import { MovementForm, movementDescription } from "./movement-form";
import { movePiece, placePiece, playtestDraft, removeMovement, removePiece, replacePiece, resizeBoard, resizeImpact, sameCell, setCellDisabled, setMovement, type EditResult } from "./model";
import styles from "./variant-editor.module.css";

export type VariantEditorProps = {
  initialVariant?: VariantDefinition;
  onPlaytest?: (variant: VariantDefinition) => void;
};

export function VariantEditor({ initialVariant = firstFlightVariant, onPlaytest }: VariantEditorProps) {
  const [draft, setDraft] = useState<VariantDefinition>(initialVariant);
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [tool, setTool] = useState("select");
  const [owner, setOwner] = useState(initialVariant.players[0]?.id ?? "");
  const [paletteType, setPaletteType] = useState(initialVariant.pieceTypes[0]?.id ?? "");
  const [typeId, setTypeId] = useState(initialVariant.pieceTypes[0]?.id ?? "");
  const [ruleIndex, setRuleIndex] = useState("0");
  const [files, setFiles] = useState(String(initialVariant.board.files));
  const [ranks, setRanks] = useState(String(initialVariant.board.ranks));
  const [pendingResize, setPendingResize] = useState<{ files: number; ranks: number } | null>(null);
  const [cell, setCell] = useState("a1");
  const [message, setMessage] = useState("First Flight is ready to customize. Changes stay in this tab; download a valid draft to keep it.");
  const issues = useMemo(() => validateVariantDefinition(draft), [draft]);
  const blocking = issues.filter(i => i.severity === "error");
  const type = draft.pieceTypes.find(t => t.id === typeId);
  const pattern = type?.movements[Number(ruleIndex)];
  const selectedPiece = draft.setup.find(p => selected && sameCell(p.at, selected));

  function commit(result: EditResult, text: string) {
    if (!result.ok) { setMessage(result.message); return false; }
    setDraft(result.value); setMessage(text); return true;
  }

  function activate(at: Coordinate) {
    const piece = draft.setup.find(p => sameCell(p.at, at));
    if (tool === "place") { commit(placePiece(draft, at, paletteType, owner), `Placed a piece on ${coordinateToSquare(at)}.`); return; }
    if (tool === "replace") { commit(replacePiece(draft, at, paletteType, owner), `Replaced the piece on ${coordinateToSquare(at)}, preserving its ID.`); return; }
    if (tool === "remove") { if (commit(removePiece(draft, at), "Piece removed.")) setSelected(null); return; }
    if (selectedPiece && !piece) {
      if (commit(movePiece(draft, selectedPiece.id, at), `Moved piece to ${coordinateToSquare(at)}.`)) setSelected(at);
    } else {
      setSelected(piece ? at : null);
      setMessage(piece ? `Selected ${piece.id}. Activate an empty cell to move it.` : "Select an existing piece to move it.");
    }
  }

  function requestResize() {
    const f = Number(files), r = Number(ranks);
    const result = resizeBoard(draft, f, r);
    if (!result.ok && Number.isInteger(f) && Number.isInteger(r) && f >= 1 && f <= 26 && r >= 1 && r <= 26) {
      setPendingResize({ files: f, ranks: r }); return;
    }
    if (commit(result, "Board resized.")) { setSelected(null); setPendingResize(null); }
  }

  function handoff() {
    const valid = playtestDraft(draft);
    if (!valid) { setMessage("Resolve blocking issues before handing off this draft."); return; }
    if (onPlaytest) { onPlaytest(valid); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(valid, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `${valid.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Downloaded the validated variant. Playtest integration will use this same draft.");
  }

  const impact = pendingResize ? resizeImpact(draft, pendingResize.files, pendingResize.ranks) : null;
  return <main className={styles.editor} onKeyDown={e => { if (e.key === "Escape") { setSelected(null); setMessage("Selection cleared."); } }}>
    <a href="#editor-board" className="skip-link">Skip to board</a>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Rookery home">
        <Image src={rookeryLogo} alt="" width={42} height={42} priority />
      </Link>
      <span className={styles.badge}>Local draft</span>
      <button className={styles.primary} disabled={blocking.length > 0} onClick={handoff}>{onPlaytest ? "Open playtest" : "Download valid draft"} <span aria-hidden="true">↗</span></button>
    </header>
    <div className={styles.intro}><div><p className={styles.eyebrow}>Variant workshop · 01</p><h1>Make your next move.</h1><p>Shape the board. Give your pieces a new way to play.</p></div><div className={styles.draftName}><strong>{draft.name}</strong><span>Capture the royal · {draft.players.length} players</span></div></div>
    <div className={styles.workspace}>
      <section className={styles.panel} aria-labelledby="setup-heading">
        <p className={styles.eyebrow}>01 · The canvas</p><h2 id="setup-heading">Board & pieces</h2>
        <form onSubmit={e => { e.preventDefault(); requestResize(); }}>
          <div className={styles.fieldRow}>
            <label>Files (columns)<input type="number" min="1" max="26" step="1" required value={files} onChange={e => { setFiles(e.target.value); setPendingResize(null); }} /></label>
            <label>Ranks (rows)<input type="number" min="1" max="26" step="1" required value={ranks} onChange={e => { setRanks(e.target.value); setPendingResize(null); }} /></label>
          </div><button type="submit">Apply board size</button>
        </form>
        {pendingResize && impact && <div className={styles.warning} role="alert" aria-label="Destructive resize confirmation">
          <strong>Resize to {pendingResize.files} × {pendingResize.ranks}?</strong>
          <p>This removes {impact.pieces.length} piece(s) and {impact.disabledCells.length} disabled cell(s).</p>
          {impact.pieces.length > 0 && <ul>{impact.pieces.map(p => <li key={p.id}>{p.id} at {coordinateToSquare(p.at)}</li>)}</ul>}
          {impact.disabledCells.length > 0 && <p>Disabled cells: {impact.disabledCells.map(coordinateToSquare).join(", ")}</p>}
          <button onClick={() => { if (commit(resizeBoard(draft, pendingResize.files, pendingResize.ranks, true), "Resize confirmed; listed items removed.")) { setPendingResize(null); setSelected(null); } }}>Confirm resize and remove</button>
          <button onClick={() => setPendingResize(null)}>Cancel resize</button>
        </div>}
        <hr />
        <fieldset className={styles.tools}><legend>Board tool</legend>{[["select", "Select / move"], ["place", "Place"], ["replace", "Replace"], ["remove", "Remove"]].map(([value, label]) => <label key={value}>
          <input type="radio" name="tool" value={value} checked={tool === value} onChange={() => { setTool(value); setSelected(null); }} />{label}
        </label>)}</fieldset>
        <label>Palette player<select value={owner} onChange={e => setOwner(e.target.value)}>{draft.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Palette piece<select value={paletteType} onChange={e => setPaletteType(e.target.value)}>{draft.pieceTypes.map(t => <option key={t.id} value={t.id}>{t.name}{t.royal ? " · royal" : ""}</option>)}</select></label>
        <p className={styles.help}>Place adds to empty cells. Replace changes an occupied cell and keeps its piece ID. Select a piece, then an empty cell to move it.</p>
        <hr /><h3>Playable cells</h3>
        <form onSubmit={e => { e.preventDefault(); const at = squareToCoordinate(cell); if (!at) { setMessage("Enter a square such as a1, up to z26."); return; } const disabled = draft.board.disabledCells.some(c => sameCell(c, at)); commit(setCellDisabled(draft, at, !disabled), `${cell} ${disabled ? "enabled" : "disabled"}.`); }}>
          <label>Cell coordinate<input value={cell} onChange={e => setCell(e.target.value)} maxLength={3} placeholder="a1" /></label>
          <button type="submit">Enable / disable cell</button>
        </form>
        <p className={styles.help}>Move or remove a piece before disabling its cell.</p>
      </section>
      <section className={styles.boardPanel} aria-labelledby="board-heading" id="editor-board">
        <div className={styles.boardTop}><h2 id="board-heading">{draft.name}</h2><span>{draft.board.files} × {draft.board.ranks} / {draft.setup.length} pieces</span></div>
        <div className={styles.boardScroll} style={{ maxHeight: draft.board.ranks > draft.board.files * 2 ? "74vh" : undefined }}><div className={styles.boardFrame} style={{ minWidth: Math.max(240, draft.board.files * 30) }}>
          <BoardSurface files={draft.board.files} ranks={draft.board.ranks} pieces={editorBoardPieces(draft)} label="Variant editor board"
            selectedSquare={selected ? coordinateToSquare(selected) : null} disabledSquares={draft.board.disabledCells.map(coordinateToSquare)}
            onSquareActivate={({ square }) => { const at = squareToCoordinate(square); if (at) activate(at); }} />
        </div></div>
        <div className={styles.boardBottom}><span>✦ {tool === "select" ? "Select & move" : tool.charAt(0).toUpperCase() + tool.slice(1)} tool</span><span>{selectedPiece?.id ?? "No piece selected"}</span></div>
        <p className={styles.help}>Keyboard: Tab to the board, arrows to navigate, Enter or Space to use the selected tool. Escape clears selection.</p>
        <p role="status" className={styles.status}>{message}</p>
      </section>
      <section className={styles.panel} aria-labelledby="movement-heading" id="movement-panel">
        <p className={styles.eyebrow}>02 · Movement</p><h2 id="movement-heading">Movement rules</h2>
        <label>Piece type to edit<select value={typeId} onChange={e => { setTypeId(e.target.value); setRuleIndex("0"); }}>{draft.pieceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Rule to edit<select value={ruleIndex} onChange={e => setRuleIndex(e.target.value)}>{type?.movements.map((m, i) => <option key={i} value={i}>Rule {i + 1} · {m.kind}</option>)}<option value="new">+ New movement rule</option></select></label>
        <MovementForm key={`${typeId}-${ruleIndex}-${JSON.stringify(pattern)}`} initial={pattern} onSave={rule => {
          const index = ruleIndex === "new" ? type?.movements.length ?? 0 : Number(ruleIndex);
          if (commit(setMovement(draft, typeId, index, rule), "Movement rule saved.")) setRuleIndex(String(index));
        }} />
        {pattern && <button className={styles.danger} onClick={() => { setDraft(removeMovement(draft, typeId, Number(ruleIndex))); setRuleIndex("new"); setMessage("Rule removed. Add a rule if this piece has none."); }}>Delete this rule</button>}
        <div className={styles.preview}><h3>How this piece moves</h3>{type?.movements.length ? type.movements.map((m, i) => <p key={i}>{movementDescription(m)}</p>) : <p>No rules yet. Add one above.</p>}</div>
      </section>
    </div>
    <section className={styles.validation} aria-labelledby="validation-heading">
      <div><p className={styles.eyebrow}>03 · Draft check</p><h2 id="validation-heading">{blocking.length ? `${blocking.length} issue${blocking.length === 1 ? "" : "s"} to resolve` : "Ready for the next move."}</h2><p>Drafts stay editable. Only blocking errors prevent handoff.</p></div>
      <div aria-live="polite">{issues.length ? <ul>{issues.map((issue, i) => <li key={`${issue.code}-${i}`} className={issue.severity === "error" ? styles.error : ""}><strong>{issue.severity === "error" ? "Error" : "Warning"}</strong> · <a href={issue.path[0] === "pieceTypes" ? "#movement-panel" : "#setup-heading"}>{issue.path.join(".") || "variant"}</a>: {issue.message}</li>)}</ul> : <p className={styles.valid}>✓ Shared schema and semantic checks pass.</p>}</div>
    </section>
    <footer className={styles.footer}>Your rules. Your board. <span>Local editor · Download your draft before leaving.</span></footer>
  </main>;
}
