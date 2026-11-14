import type { VariantDefinition } from "@rookery/rules";
import {
  checkDraft,
  decodeEnvelope,
  draftErrorMessages,
  DRAFT_STORAGE_KEY,
  MAX_IMPORT_BYTES,
  serializeStoredEnvelope,
  type DraftErrorCode,
  type DraftIssue,
} from "./envelope";
import type { DraftStorage } from "./storage";

export type LoadResult =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "unavailable"; code: "STORAGE_UNAVAILABLE"; message: string }>
  | Readonly<{ status: "restored"; variant: VariantDefinition; savedAt: string | null }>
  | Readonly<{ status: "failed"; code: DraftErrorCode; message: string; issues: readonly DraftIssue[]; raw: string }>;

export type SaveResult =
  | Readonly<{ status: "saved"; savedAt: string }>
  | Readonly<{ status: "unchanged" }>
  | Readonly<{ status: "failed"; code: DraftErrorCode; message: string; issues: readonly DraftIssue[] }>;

export type ClearResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: DraftErrorCode; message: string }>;

/** Replaceable persistence boundary. A future server adapter implements this same interface. */
export interface DraftRepository {
  load(): Promise<LoadResult>;
  save(variant: VariantDefinition): Promise<SaveResult>;
  clear(): Promise<ClearResult>;
  /** Treats a loaded, imported, or reset draft as already saved so it is not rewritten unchanged. */
  markBaseline(variant: VariantDefinition): void;
}

/**
 * Browser-storage repository. Storage calls are synchronous, so every operation
 * completes in call order before its promise is returned; an earlier save can
 * never finish after a newer one. This also lets a lifecycle flush write before
 * the page is hidden. Async adapters must preserve the same ordering.
 */
export function createDraftRepository(storage: DraftStorage | null, now: () => Date = () => new Date()): DraftRepository {
  let lastWritten: string | null = null;

  function load(): LoadResult {
    if (!storage) return unavailable();

    let raw: string | null;
    try {
      raw = storage.read(DRAFT_STORAGE_KEY);
    } catch (error) {
      const code = storageErrorCode(error, "STORAGE_READ_FAILED");
      return code === "STORAGE_UNAVAILABLE" ? unavailable() : failed(code, [], "");
    }

    if (raw === null) return { status: "empty" };

    const retained = raw.slice(0, MAX_IMPORT_BYTES);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return failed("ENVELOPE_MALFORMED", [{
        code: "ENVELOPE_MALFORMED",
        severity: "error",
        path: [],
        message: "The saved draft is not valid JSON.",
      }], retained);
    }

    const decoded = decodeEnvelope(parsed);
    if (!decoded.ok) return failed(decoded.code, decoded.issues, retained);
    if (decoded.source !== "envelope") {
      return failed("ENVELOPE_MALFORMED", [{
        code: "ENVELOPE_MALFORMED",
        severity: "error",
        path: [],
        message: "The saved draft is missing its Rookery envelope.",
      }], retained);
    }

    lastWritten = JSON.stringify(decoded.variant);
    return { status: "restored", variant: decoded.variant, savedAt: decoded.savedAt };
  }

  function save(variant: VariantDefinition): SaveResult {
    const checked = checkDraft(variant);

    if (!checked.ok) {
      return { status: "failed", code: "VARIANT_INVALID", message: draftErrorMessages.VARIANT_INVALID, issues: checked.issues };
    }

    if (checked.text === lastWritten) return { status: "unchanged" };
    if (!storage) return saveFailure("STORAGE_UNAVAILABLE");

    const savedAt = now().toISOString();
    try {
      storage.write(DRAFT_STORAGE_KEY, serializeStoredEnvelope(checked.variant, savedAt));
    } catch (error) {
      return saveFailure(storageErrorCode(error, "STORAGE_WRITE_FAILED"));
    }

    lastWritten = checked.text;
    return { status: "saved", savedAt };
  }

  function clear(): ClearResult {
    if (!storage) return { ok: false, code: "STORAGE_UNAVAILABLE", message: draftErrorMessages.STORAGE_UNAVAILABLE };

    try {
      storage.remove(DRAFT_STORAGE_KEY);
    } catch (error) {
      const code = storageErrorCode(error, "STORAGE_WRITE_FAILED");
      return { ok: false, code, message: draftErrorMessages[code] };
    }

    lastWritten = null;
    return { ok: true };
  }

  return {
    load: () => Promise.resolve(load()),
    save: (variant) => Promise.resolve(save(variant)),
    clear: () => Promise.resolve(clear()),
    markBaseline(variant) {
      const checked = checkDraft(variant);
      lastWritten = checked.ok ? checked.text : null;
    },
  };
}

function storageErrorCode(error: unknown, fallback: DraftErrorCode): DraftErrorCode {
  const name = typeof error === "object" && error !== null && "name" in error ? (error as { name: unknown }).name : null;
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return "STORAGE_QUOTA_EXCEEDED";
  if (name === "SecurityError") return "STORAGE_UNAVAILABLE";
  return fallback;
}

function unavailable(): LoadResult {
  return { status: "unavailable", code: "STORAGE_UNAVAILABLE", message: draftErrorMessages.STORAGE_UNAVAILABLE };
}

function failed(code: DraftErrorCode, issues: readonly DraftIssue[], raw: string): LoadResult {
  return { status: "failed", code, message: draftErrorMessages[code], issues, raw };
}

function saveFailure(code: DraftErrorCode): SaveResult {
  return { status: "failed", code, message: draftErrorMessages[code], issues: [] };
}
