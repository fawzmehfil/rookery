"use client";

import { useEffect, useRef, useState } from "react";
import type { VariantDefinition } from "@rookery/rules";
import { ConfirmChange } from "@/features/objective-editor/confirmation";
import { downloadText } from "./download";
import { exportDraft } from "./envelope";
import { formatTime, type RecoveryNotice, type SaveStatus } from "./use-draft-persistence";
import styles from "./draft-controls.module.css";

export type DraftControlsProps = {
  /** The editor's current draft, used for export. */
  draft: VariantDefinition;
  status: SaveStatus;
  notice: RecoveryNotice | null;
  onReset: () => Promise<void>;
};

/** Save status, export, reset, and recovery guidance for the local draft. */
export function DraftControls({ draft, status, notice, onReset }: DraftControlsProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [feedback, setFeedback] = useState("");

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
        <button type="button" onClick={() => setConfirmingReset(true)}>Reset draft</button>
      </div>
      <p className={styles.feedback} aria-live="polite">{feedback}</p>
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

function RecoveryAlert({ notice, onReset }: { notice: Extract<RecoveryNotice, { kind: "failed" }>; onReset: () => void }) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  function downloadRaw() {
    downloadText("rookery-unrecoverable-draft.txt", notice.raw, "text/plain");
  }

  return (
    <div className={styles.alert} role="alert" tabIndex={-1} ref={alertRef} aria-labelledby="recovery-heading">
      <h3 id="recovery-heading">Your saved draft could not be restored</h3>
      <p><strong>{notice.code}</strong>: {notice.message}</p>
      {notice.issues.length > 0 && (
        <ul>
          {notice.issues.slice(0, 5).map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <code>{issue.path.join(".") || "draft"}</code>: {issue.message}
            </li>
          ))}
          {notice.issues.length > 5 && <li>…and {notice.issues.length - 5} more.</li>}
        </ul>
      )}
      <p>First Flight is open instead. The stored data is kept until you edit this draft or reset it.</p>
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
