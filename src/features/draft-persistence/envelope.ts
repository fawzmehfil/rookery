import { parseVariantDefinition, type VariantDefinition } from "@rookery/rules";
import { draftIssues, type EditorIssue } from "@/features/variant-editor/model";

// Imported by both the repository and the editor; keep it free of React and browser APIs.

/** The single namespaced browser-storage key for the current editor draft. */
export const DRAFT_STORAGE_KEY = "rookery.editor.draft";
export const ENVELOPE_FORMAT = "rookery.variant-draft";
export const ENVELOPE_VERSION = 1;
/** Practical import limit; far above the largest bounded variant a creator can author. */
export const MAX_IMPORT_BYTES = 1_048_576;

export type DraftIssue = EditorIssue;

export type DraftErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_QUOTA_EXCEEDED"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "ENVELOPE_MALFORMED"
  | "ENVELOPE_UNSUPPORTED_VERSION"
  | "IMPORT_TOO_LARGE"
  | "IMPORT_EMPTY"
  | "IMPORT_NOT_JSON"
  | "IMPORT_READ_FAILED"
  | "VARIANT_INVALID";

export const draftErrorMessages: Readonly<Record<DraftErrorCode, string>> = {
  STORAGE_UNAVAILABLE: "Browser storage is unavailable, so autosave is off. Export your draft to keep it.",
  STORAGE_QUOTA_EXCEEDED: "Browser storage is full. Your draft is still open; export it to keep it.",
  STORAGE_READ_FAILED: "The saved draft could not be read. Reset it or import a saved export.",
  STORAGE_WRITE_FAILED: "The draft could not be saved. Export it to keep it; autosave retries on the next change.",
  ENVELOPE_MALFORMED: "This is not a readable Rookery draft. Download the stored data, then reset or import an export.",
  ENVELOPE_UNSUPPORTED_VERSION: "This draft comes from a newer version of Rookery. Open it there, or reset.",
  IMPORT_TOO_LARGE: "This file is larger than 1 MiB. Choose a Rookery export.",
  IMPORT_EMPTY: "This file is empty. Choose a Rookery export.",
  IMPORT_NOT_JSON: "This file is not valid JSON. Choose a Rookery export.",
  IMPORT_READ_FAILED: "The browser could not read this file. Choose it again or pick another export.",
  VARIANT_INVALID: "This variant has problems to fix before it can be loaded.",
};

export type DecodeResult =
  | Readonly<{
      ok: true;
      variant: VariantDefinition;
      source: "envelope" | "legacy-variant";
      savedAt: string | null;
    }>
  | Readonly<{ ok: false; code: DraftErrorCode; message: string; issues: readonly DraftIssue[] }>;

export type ExportResult =
  | Readonly<{ ok: true; fileName: string; text: string }>
  | Readonly<{ ok: false; code: "VARIANT_INVALID"; message: string; issues: readonly DraftIssue[] }>;

const ENVELOPE_KEYS = new Set(["format", "envelopeVersion", "variantSchemaVersion", "savedAt", "variant"]);
const MAX_SAVED_AT_LENGTH = 40;

/**
 * The single trust boundary for stored drafts and imported files. Accepts a
 * version 1 envelope or a legacy bare VariantDefinition and returns either an
 * independent canonical variant or every blocking issue.
 */
export function decodeEnvelope(raw: unknown): DecodeResult {
  if (!isPlainObject(raw)) {
    return failure("ENVELOPE_MALFORMED", [envelopeIssue([], "Expected a JSON object at the top level.")]);
  }

  if (Object.hasOwn(raw, "format")) {
    const migrated = migrateEnvelope(raw);
    if (!migrated.ok) return migrated;
    return decodeVariant(migrated.variant, "envelope", migrated.savedAt);
  }

  if (Object.hasOwn(raw, "schemaVersion")) return decodeVariant(raw, "legacy-variant", null);

  return failure("ENVELOPE_MALFORMED", [envelopeIssue([], "Expected a Rookery draft envelope or variant definition.")]);
}

/**
 * Migration extension point. Each supported envelope version converts to the
 * current shape here. An incompatible change must raise ENVELOPE_VERSION, add a
 * case for the previous version, and add round-trip tests for both. Variant
 * schema versions are never upgraded here.
 */
function migrateEnvelope(
  raw: Readonly<Record<string, unknown>>,
): Readonly<{ ok: true; variant: unknown; savedAt: string | null }> | Extract<DecodeResult, { ok: false }> {
  if (raw.format !== ENVELOPE_FORMAT) {
    return failure("ENVELOPE_MALFORMED", [envelopeIssue(["format"], `Expected format "${ENVELOPE_FORMAT}".`)]);
  }

  if (!Number.isInteger(raw.envelopeVersion)) {
    return failure("ENVELOPE_MALFORMED", [envelopeIssue(["envelopeVersion"], "Expected a whole-number envelope version.")]);
  }

  switch (raw.envelopeVersion) {
    case 1:
      return readVersionOne(raw);
    default:
      return failure("ENVELOPE_UNSUPPORTED_VERSION", [{
        code: "ENVELOPE_UNSUPPORTED_VERSION",
        severity: "error",
        path: ["envelopeVersion"],
        message: `Envelope version ${String(raw.envelopeVersion)} is not supported; this release reads version ${ENVELOPE_VERSION}.`,
      }]);
  }
}

function readVersionOne(
  raw: Readonly<Record<string, unknown>>,
): Readonly<{ ok: true; variant: unknown; savedAt: string | null }> | Extract<DecodeResult, { ok: false }> {
  const issues: DraftIssue[] = [];

  for (const key of Object.keys(raw)) {
    if (!ENVELOPE_KEYS.has(key)) issues.push(envelopeIssue([key], `Unexpected envelope field "${key}".`));
  }

  if (!Object.hasOwn(raw, "variant")) issues.push(envelopeIssue(["variant"], "The envelope has no variant."));

  if (!Number.isInteger(raw.variantSchemaVersion)) {
    issues.push(envelopeIssue(["variantSchemaVersion"], "Expected a whole-number variant schema version."));
  } else if (isPlainObject(raw.variant) && raw.variant.schemaVersion !== raw.variantSchemaVersion) {
    issues.push(envelopeIssue(["variantSchemaVersion"], "The envelope and variant schema versions do not match."));
  }

  const savedAt = raw.savedAt;
  if (savedAt !== undefined && !isTimestamp(savedAt)) {
    issues.push(envelopeIssue(["savedAt"], "Expected an ISO 8601 timestamp."));
  }

  if (issues.length > 0) return failure("ENVELOPE_MALFORMED", issues);

  return { ok: true, variant: raw.variant, savedAt: typeof savedAt === "string" ? savedAt : null };
}

export type CheckedDraft =
  | Readonly<{ ok: true; variant: VariantDefinition; text: string }>
  | Readonly<{ ok: false; issues: readonly DraftIssue[] }>;

/**
 * Parses and semantically checks a draft with the same gate as playtest
 * handoff. The parser builds new objects in schema key order, so a successful
 * result is an independent canonical copy sharing nothing with its input, and
 * `text` is its compact canonical serialization for change detection.
 */
export function checkDraft(input: unknown): CheckedDraft {
  const parsed = parseVariantDefinition(input);

  if (!parsed.ok) {
    return {
      ok: false,
      issues: parsed.issues.map((issue) => ({
        code: "SCHEMA_INVALID",
        severity: "error" as const,
        message: issue.message,
        path: issue.path,
      })),
    };
  }

  const blocking = draftIssues(parsed.value).filter(({ severity }) => severity === "error");
  if (blocking.length > 0) return { ok: false, issues: blocking };

  return { ok: true, variant: parsed.value, text: JSON.stringify(parsed.value) };
}

function decodeVariant(input: unknown, source: "envelope" | "legacy-variant", savedAt: string | null): DecodeResult {
  const checked = checkDraft(input);
  return checked.ok ? { ok: true, variant: checked.variant, source, savedAt } : failure("VARIANT_INVALID", checked.issues);
}

/** Reads a selected file's text as untrusted input. Nothing is evaluated. */
export function parseImportText(text: string, byteSize: number): DecodeResult {
  if (!Number.isFinite(byteSize) || byteSize > MAX_IMPORT_BYTES || text.length > MAX_IMPORT_BYTES) {
    return failure("IMPORT_TOO_LARGE", []);
  }

  if (text.trim() === "") return failure("IMPORT_EMPTY", []);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return failure("IMPORT_NOT_JSON", []);
  }

  return decodeEnvelope(raw);
}

/** Serializes the browser-storage envelope. Assumes a canonical variant that already passed checkDraft. */
export function serializeStoredEnvelope(variant: VariantDefinition, savedAt: string): string {
  return serialize({
    format: ENVELOPE_FORMAT,
    envelopeVersion: ENVELOPE_VERSION,
    variantSchemaVersion: variant.schemaVersion,
    savedAt,
    variant,
  });
}

/**
 * Builds a deterministic, human-readable export. The same draft always produces
 * byte-identical text because the export omits savedAt and uses canonical key order.
 */
export function exportDraft(variant: VariantDefinition): ExportResult {
  const checked = checkDraft(variant);

  if (!checked.ok) {
    return { ok: false, code: "VARIANT_INVALID", message: draftErrorMessages.VARIANT_INVALID, issues: checked.issues };
  }

  return {
    ok: true,
    fileName: exportFileName(checked.variant),
    text: serialize({
      format: ENVELOPE_FORMAT,
      envelopeVersion: ENVELOPE_VERSION,
      variantSchemaVersion: checked.variant.schemaVersion,
      variant: checked.variant,
    }),
  };
}

export function exportFileName(variant: Pick<VariantDefinition, "id" | "name">): string {
  return `${slug(variant.id) || slug(variant.name) || "variant"}.rookery.json`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 64).replace(/-+$/, "");
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_SAVED_AT_LENGTH && !Number.isNaN(Date.parse(value));
}

function envelopeIssue(path: readonly (string | number)[], message: string): DraftIssue {
  return { code: "ENVELOPE_MALFORMED", severity: "error", path, message };
}

function failure(code: DraftErrorCode, issues: readonly DraftIssue[]): Extract<DecodeResult, { ok: false }> {
  return { ok: false, code, message: draftErrorMessages[code], issues };
}
