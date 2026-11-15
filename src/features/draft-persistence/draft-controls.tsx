"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import type { VariantDefinition } from "@rookery/rules";
import { ConfirmChange } from "@/features/objective-editor/confirmation";
import { objectiveChoices } from "@/features/objective-editor/model";
import { downloadText } from "./download";
import {
  draftErrorMessages,
  exportDraft,
  MAX_IMPORT_BYTES,
  parseImportText,
  type DecodeResult,
  type DraftErrorCode,
  type DraftIssue,
} from "./envelope";
import { readFileText } from "./read-file";
import { formatTime, type LastImport, type RecoveryNotice, type SaveStatus } from "./use-draft-persistence";
import styles from "./draft-controls.module.css";

export type DraftControlsProps = {
  /** The editor's current draft, used for export. */
  draft: VariantDefinition;
  status: SaveStatus;
  notice: RecoveryNotice | null;
  onReset: () => Promise<void>;
  /** Receives an import that already passed every validation step. */
  onImport: (variant: VariantDefinition, fileName: string) => void;
  lastImport: LastImport | null;
  onUndoImport: () => void;
};

type ImportFailure = Readonly<{ fileName: string; code: DraftErrorCode; message: string; issues: readonly DraftIssue[] }>;
type PendingImport = Readonly<{ fileName: string; variant: VariantDefinition; source: "envelope" | "legacy-variant" }>;

const MAX_LISTED_ISSUES = 10;

/** Save status, export, import, reset, and recovery guidance for the local draft. */
export function DraftControls({ draft, status, notice, onReset, onImport, lastImport, onUndoImport }: DraftControlsProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reading, setReading] = useState(false);
  const [importFailure, setImportFailure] = useState<ImportFailure | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  function exportJson() {
    // Validation runs only on request; an invalid draft never produces a file.
    const result = exportDraft(draft);
    if (!result.ok) {
      const count = result.issues.length;
      setFeedback(`Resolve ${count} issue${count === 1 ? "" : "s"} before exporting. Export uses the same checks as playtest.`);
      return;
    }
    downloadText(result.fileName, result.text, "application/json");
    setFeedback(`Exported ${result.fileName}.`);
  }

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Clearing the input lets the same file be chosen again after a fix.
    input.value = "";
    if (!file) return;

    setFeedback("");
    setImportFailure(null);
    setPendingImport(null);

    const result = await decodeFile(file, setReading);
    if (!result.ok) {
      setImportFailure({ fileName: file.name, code: result.code, message: result.message, issues: result.issues });
      return;
    }
    // Nothing changes until the creator confirms the summary.
    setPendingImport({ fileName: file.name, variant: result.variant, source: result.source });
  }

  return (
    <section className={styles.controls} aria-labelledby="draft-heading">
      <div className={styles.summary}>
        <h2 id="draft-heading">Your draft</h2>
        <p role="status" aria-live="polite" className={status.kind === "error" || status.kind === "invalid" ? styles.attention : styles.statusText}>
          {statusText(status)}
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={exportJson}>Export JSON</button>
        <label className={styles.fileButton}>
          {reading ? "Reading file…" : "Import JSON"}
          <input type="file" accept=".json,application/json" onChange={chooseImport} disabled={reading} />
        </label>
        <button type="button" onClick={() => setConfirmingReset(true)}>Reset draft</button>
      </div>
      <p className={styles.feedback} aria-live="polite">{feedback}</p>
      {lastImport && <ImportedNotice lastImport={lastImport} onUndo={onUndoImport} />}
      {importFailure && <ImportFailureAlert failure={importFailure} onDismiss={() => setImportFailure(null)} />}
      {pendingImport && (
        <ConfirmChange
          message={`Replace your current draft with this import? ${importSummary(pendingImport)} You can undo the import until your next edit.`}
          confirmLabel={`Confirm import ${pendingImport.variant.name}`}
          onCancel={() => {
            setPendingImport(null);
            setFeedback("Import cancelled. Your draft is unchanged.");
          }}
          onConfirm={() => {
            const { variant, fileName } = pendingImport;
            setPendingImport(null);
            onImport(variant, fileName);
          }}
        />
      )}
      {notice?.kind === "failed" && <RecoveryAlert notice={notice} onReset={() => setConfirmingReset(true)} />}
      {notice?.kind === "unavailable" && (
        <p className={styles.alert} role="alert">Autosave is off: {notice.message}</p>
      )}
      {confirmingReset && (
        <ConfirmChange
          message="Reset to First Flight? This clears the draft saved in this browser and replaces the current board, pieces, movement and objective."
          confirmLabel="Confirm reset to First Flight"
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => {
            setConfirmingReset(false);
            void onReset();
          }}
        />
      )}
    </section>
  );
}

/** Reads and decodes a chosen file. Oversized files are rejected from their size without being read. */
async function decodeFile(file: File, setReading: (reading: boolean) => void): Promise<DecodeResult> {
  if (file.size > MAX_IMPORT_BYTES) return parseImportText("", file.size);

  setReading(true);
  try {
    return parseImportText(await readFileText(file), file.size);
  } catch {
    return { ok: false, code: "IMPORT_READ_FAILED", message: draftErrorMessages.IMPORT_READ_FAILED, issues: [] };
  } finally {
    setReading(false);
  }
}

export function importSummary({ variant, source }: Pick<PendingImport, "variant" | "source">): string {
  const objective = objectiveChoices.find(({ type }) => type === variant.objectives[0]?.type)?.name ?? "Unknown objective";
  const types = variant.pieceTypes.length;
  const pieces = variant.setup.length;
  const legacy = source === "legacy-variant" ? " This is an older Rookery variant file without a draft envelope." : "";
  return `${variant.name}: ${variant.board.files} × ${variant.board.ranks} board, ${objective}, ${types} piece type${types === 1 ? "" : "s"}, ${pieces} starting piece${pieces === 1 ? "" : "s"}.${legacy}`;
}

function ImportedNotice({ lastImport, onUndo }: { lastImport: LastImport; onUndo: () => void }) {
  const noticeRef = useRef<HTMLDivElement>(null);

  // The editor remounts on import, so focus the result instead of leaving it on the page body.
  useLayoutEffect(() => {
    noticeRef.current?.focus();
  }, []);

  return (
    <div className={styles.notice} role="group" aria-label="Import result" tabIndex={-1} ref={noticeRef}>
      <p>Imported {lastImport.name} from {lastImport.fileName}. It replaces {lastImport.previousName} and is saved in this browser.</p>
      <button type="button" onClick={onUndo}>Undo import</button>
    </div>
  );
}

function ImportFailureAlert({ failure, onDismiss }: { failure: ImportFailure; onDismiss: () => void }) {
  const alertRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    alertRef.current?.focus();
  }, [failure]);

  return (
    <div className={styles.alert} role="alert" tabIndex={-1} ref={alertRef} aria-labelledby="import-failure-heading">
      <h3 id="import-failure-heading">Import failed: {failure.fileName}</h3>
      <p><strong>{failure.code}</strong>: {failure.message}</p>
      <IssueList issues={failure.issues} />
      <p>Your current draft and its saved copy are unchanged.</p>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

function IssueList({ issues }: { issues: readonly DraftIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul>
      {issues.slice(0, MAX_LISTED_ISSUES).map((issue, index) => (
        <li key={`${issue.code}-${index}`}>
          <code>{issue.code}</code> · <code>{issue.path.join(".") || "file"}</code>: {issue.message}
        </li>
      ))}
      {issues.length > MAX_LISTED_ISSUES && <li>…and {issues.length - MAX_LISTED_ISSUES} more.</li>}
    </ul>
  );
}

function RecoveryAlert({ notice, onReset }: { notice: Extract<RecoveryNotice, { kind: "failed" }>; onReset: () => void }) {
  const alertRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    alertRef.current?.focus();
  }, []);

  function downloadRaw() {
    downloadText("rookery-unrecoverable-draft.txt", notice.raw, "text/plain");
  }

  return (
    <div className={styles.alert} role="alert" tabIndex={-1} ref={alertRef} aria-labelledby="recovery-heading">
      <h3 id="recovery-heading">Your saved draft could not be restored</h3>
      <p><strong>{notice.code}</strong>: {notice.message}</p>
      <IssueList issues={notice.issues} />
      <p>First Flight is open instead. The stored data is kept until you edit this draft or reset it. You can also use Import JSON to load a saved export.</p>
      <div className={styles.actions}>
        {notice.raw && <button type="button" onClick={downloadRaw}>Download stored data</button>}
        <button type="button" onClick={onReset}>Reset saved draft</button>
      </div>
    </div>
  );
}

export function statusText(status: SaveStatus): string {
  switch (status.kind) {
    case "idle":
      return status.lastSavedAt
        ? `Saved in this browser at ${formatTime(status.lastSavedAt)}.`
        : "Autosave is on. Valid changes save in this browser.";
    case "pending":
      return "Saving…";
    case "saved":
      return `Saved in this browser at ${formatTime(status.savedAt)}.`;
    case "invalid":
      return `Not saved: resolve ${status.count} issue${status.count === 1 ? "" : "s"}. ${
        status.lastSavedAt ? `Last valid draft kept (${formatTime(status.lastSavedAt)}).` : "Nothing has been saved yet."
      }`;
    case "error":
      return `Couldn't save: ${status.message}`;
  }
}
