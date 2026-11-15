"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VariantDefinition } from "@rookery/rules";
import { firstFlightVariant } from "@rookery/rules/fixtures";
import type { DraftErrorCode, DraftIssue } from "./envelope";
import { createDraftRepository, type DraftRepository, type SaveResult } from "./repository";
import { browserDraftStorage } from "./storage";

/** Documented autosave debounce: a save runs this long after the last draft change. */
export const AUTOSAVE_DELAY_MS = 600;

export type SaveStatus =
  | Readonly<{ kind: "idle"; lastSavedAt: string | null }>
  | Readonly<{ kind: "pending" }>
  | Readonly<{ kind: "saved"; savedAt: string }>
  | Readonly<{ kind: "invalid"; count: number; lastSavedAt: string | null }>
  | Readonly<{ kind: "error"; code: DraftErrorCode; message: string }>;

export type RecoveryNotice =
  | Readonly<{ kind: "failed"; code: DraftErrorCode; message: string; issues: readonly DraftIssue[]; raw: string }>
  | Readonly<{ kind: "unavailable"; message: string }>;

export type DraftPersistence =
  | Readonly<{ phase: "restoring" }>
  | Readonly<{
      phase: "ready";
      /** The draft the editor mounts from; changes only on restore, reset, or return from playtest. */
      editorDraft: VariantDefinition;
      /** Changing key remounts the editor so all editor-local state starts from editorDraft. */
      editorKey: number;
      editorMessage: string | undefined;
      status: SaveStatus;
      notice: RecoveryNotice | null;
      onDraftChange: (draft: VariantDefinition) => void;
      /** Writes any pending save now and keeps the latest draft for the next editor mount. */
      handoff: () => VariantDefinition;
      returnToEditor: () => void;
      reset: () => Promise<void>;
      /** Replaces the draft with an already validated import and saves it immediately. */
      importDraft: (variant: VariantDefinition, fileName: string) => void;
      /** Restores the draft from before the last import; available until the next edit, reset, or import. */
      undoImport: () => void;
      lastImport: LastImport | null;
    }>;

export type LastImport = Readonly<{ name: string; fileName: string; previousName: string }>;
type ImportRecord = Readonly<{ info: LastImport; previous: VariantDefinition }>;

type Ready = Extract<DraftPersistence, { phase: "ready" }>;
type EditorState = Readonly<{ draft: VariantDefinition; key: number; message: string | undefined }>;

/**
 * Owns local draft persistence for the workshop: recovery on first render,
 * debounced autosave, lifecycle flushes, and reset. Browser APIs are touched
 * only inside effects and event handlers, so server and first client renders
 * both show the restoring phase.
 */
export function useDraftPersistence(injected?: DraftRepository): DraftPersistence {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle", lastSavedAt: null });
  const [notice, setNotice] = useState<RecoveryNotice | null>(null);
  const [lastImport, setLastImport] = useState<ImportRecord | null>(null);

  const repositoryRef = useRef<DraftRepository | null>(null);
  const latestRef = useRef<VariantDefinition | null>(null);
  const mountedDraftRef = useRef<VariantDefinition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revisionRef = useRef(0);
  const lastSavedAtRef = useRef<string | null>(null);
  /** After a failed recovery, autosave waits for the first edit so the raw stored value survives. */
  const pausedRef = useRef(false);

  const applySaveResult = useCallback((result: SaveResult, revision: number) => {
    if (revision !== revisionRef.current) return;
    if (result.status === "saved") {
      lastSavedAtRef.current = result.savedAt;
      setStatus({ kind: "saved", savedAt: result.savedAt });
    } else if (result.status === "unchanged") {
      setStatus(lastSavedAtRef.current ? { kind: "saved", savedAt: lastSavedAtRef.current } : { kind: "idle", lastSavedAt: null });
    } else if (result.code === "VARIANT_INVALID") {
      setStatus({ kind: "invalid", count: Math.max(result.issues.length, 1), lastSavedAt: lastSavedAtRef.current });
    } else {
      setStatus({ kind: "error", code: result.code, message: result.message });
    }
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;

    const repository = repositoryRef.current;
    const draft = latestRef.current;
    if (!repository || !draft) return;

    const revision = revisionRef.current;
    // Browser storage is synchronous: the write happens before this returns,
    // which is what makes lifecycle flushes reliable.
    void repository.save(draft).then((result) => applySaveResult(result, revision));
  }, [applySaveResult]);

  // Recovery runs once per repository. A cancelled or superseded load is ignored.
  useEffect(() => {
    const repository = injected ?? createDraftRepository(browserDraftStorage());
    repositoryRef.current = repository;
    const revision = revisionRef.current;
    let cancelled = false;

    void repository.load().then((result) => {
      if (cancelled || revision !== revisionRef.current) return;

      let draft: VariantDefinition;
      let message: string | undefined;

      if (result.status === "restored") {
        draft = result.variant;
        lastSavedAtRef.current = result.savedAt;
        message = result.savedAt
          ? `Restored your draft saved at ${formatTime(result.savedAt)}.`
          : "Restored your saved draft.";
        setStatus(result.savedAt ? { kind: "saved", savedAt: result.savedAt } : { kind: "idle", lastSavedAt: null });
      } else {
        draft = freshDefault();
        repository.markBaseline(draft);
        if (result.status === "failed") {
          pausedRef.current = true;
          setNotice({ kind: "failed", code: result.code, message: result.message, issues: result.issues, raw: result.raw });
          message = "Your saved draft could not be restored, so First Flight is open. See Your draft for recovery options.";
        } else if (result.status === "unavailable") {
          setNotice({ kind: "unavailable", message: result.message });
          setStatus({ kind: "error", code: result.code, message: result.message });
        }
      }

      latestRef.current = draft;
      mountedDraftRef.current = draft;
      setEditor({ draft, key: 0, message });
    });

    return () => {
      cancelled = true;
    };
  }, [injected]);

  // Flush a pending save when the page is hidden or closed, and when the workshop unmounts.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  const onDraftChange = useCallback((draft: VariantDefinition) => {
    // The editor reports its initial draft on mount; that is not an edit.
    if (draft === mountedDraftRef.current && draft === latestRef.current) return;

    latestRef.current = draft;
    revisionRef.current += 1;
    pausedRef.current = false;
    setNotice((current) => (current?.kind === "failed" ? null : current));
    // Undo would discard this edit, so it is only offered until the next change.
    setLastImport(null);
    setStatus({ kind: "pending" });

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }, [flush]);

  const handoff = useCallback(() => {
    if (!pausedRef.current) flush();
    const draft = latestRef.current ?? freshDefault();
    mountedDraftRef.current = draft;
    setLastImport(null);
    setEditor((current) => (current ? { ...current, draft, message: undefined } : current));
    return draft;
  }, [flush]);

  const returnToEditor = useCallback(() => {
    setEditor((current) => (current ? { ...current, message: "Back from playtest. Your draft is unchanged." } : current));
  }, []);

  const reset = useCallback(async () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    revisionRef.current += 1;
    const revision = revisionRef.current;
    const repository = repositoryRef.current;
    const draft = freshDefault();

    const cleared = repository ? await repository.clear() : null;
    if (revision !== revisionRef.current) return;

    repository?.markBaseline(draft);
    pausedRef.current = false;
    lastSavedAtRef.current = null;
    latestRef.current = draft;
    mountedDraftRef.current = draft;
    setNotice((current) => (current?.kind === "failed" ? null : current));
    setLastImport(null);
    setStatus(cleared && !cleared.ok ? { kind: "error", code: cleared.code, message: cleared.message } : { kind: "idle", lastSavedAt: null });
    setEditor((current) => ({
      draft,
      key: (current?.key ?? 0) + 1,
      message: "Reset to First Flight. The saved draft was cleared.",
    }));
  }, []);

  /** Replaces the editor's draft, remounts the editor, and saves at once rather than after the debounce. */
  const replaceDraft = useCallback((draft: VariantDefinition, message: string) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    revisionRef.current += 1;
    const revision = revisionRef.current;
    pausedRef.current = false;
    latestRef.current = draft;
    mountedDraftRef.current = draft;
    setNotice((current) => (current?.kind === "failed" ? null : current));
    setEditor((current) => ({ draft, key: (current?.key ?? 0) + 1, message }));

    const repository = repositoryRef.current;
    if (repository) void repository.save(draft).then((result) => applySaveResult(result, revision));
  }, [applySaveResult]);

  const importDraft = useCallback((variant: VariantDefinition, fileName: string) => {
    const previous = latestRef.current ?? freshDefault();
    replaceDraft(variant, `Imported ${variant.name} from ${fileName}.`);
    setLastImport({ info: { name: variant.name, fileName, previousName: previous.name }, previous });
  }, [replaceDraft]);

  const undoImport = useCallback(() => {
    if (!lastImport) return;
    replaceDraft(lastImport.previous, `Import undone. ${lastImport.previous.name} is back.`);
    setLastImport(null);
  }, [lastImport, replaceDraft]);

  if (!editor) return { phase: "restoring" };

  const ready: Ready = {
    phase: "ready",
    editorDraft: editor.draft,
    editorKey: editor.key,
    editorMessage: editor.message,
    status,
    notice,
    onDraftChange,
    handoff,
    returnToEditor,
    reset,
    importDraft,
    undoImport,
    lastImport: lastImport?.info ?? null,
  };
  return ready;
}

function freshDefault(): VariantDefinition {
  return structuredClone(firstFlightVariant);
}

/** Client-only formatting; the restoring phase is what the server renders. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
