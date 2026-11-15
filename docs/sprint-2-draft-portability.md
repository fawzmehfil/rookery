# Sprint 2 autosave, recovery, and JSON portability

Task: S2-07 — Add autosave, recovery, and JSON portability (Notion URL not supplied).
Branch: `ramish/local-draft-portability`, based on current main after S2-01, S2-04
and S2-05.

This document records the persistence contract before any editor controls are
connected. It is local-only: no account, database, server API, cookie,
cross-device sync, or multiplayer session state is introduced.

## Boundaries

- The draft remains exactly the public `VariantDefinition`. Persistence wraps it
  in an envelope; it never adds UI-only fields to the variant.
- Only the variant is stored or exported. Selection, tools, open dialogs, custom
  piece tokens, `GameState`, playtest history, absolute paths, and build metadata
  are never written.
- `src/features/draft-persistence/storage.ts` is the only module that touches
  `localStorage`. Every other module uses the typed interfaces below, so a future
  server adapter can replace browser storage without rewriting editor logic.
- Variant validity always comes from the public `parseVariantDefinition` and
  semantic validation. This feature adds envelope checks only; it does not add a
  second variant schema.
- Browser APIs are used only in effects and event handlers. The server render and
  the first client render show a "Restoring your draft…" status, so recovery
  cannot cause a hydration mismatch.

## Storage key and envelope

One namespaced key holds the current draft:

```text
rookery.editor.draft
```

Stored envelope (version 1):

```json
{
  "format": "rookery.variant-draft",
  "envelopeVersion": 1,
  "variantSchemaVersion": 2,
  "savedAt": "2026-11-14T17:04:12.345Z",
  "variant": { "schemaVersion": 2, "id": "the-long-walk", "...": "..." }
}
```

| Field | Rule |
| --- | --- |
| `format` | Exactly `"rookery.variant-draft"`. |
| `envelopeVersion` | Integer. `1` is the only supported version. |
| `variantSchemaVersion` | Must equal `variant.schemaVersion`. |
| `savedAt` | ISO 8601 UTC string. Present in storage, omitted from exports. |
| `variant` | A `VariantDefinition` that must pass parsing and semantic validation. |

No other envelope keys are accepted. Keys are checked as own properties, so
`__proto__`, `constructor`, and similar keys are rejected rather than merged.

### Exported file

An export is the same envelope without `savedAt`, so the same draft always
produces byte-identical output:

- The variant is the parsed, canonical value: schema defaults are applied and
  keys follow schema order.
- The text is `JSON.stringify(envelope, null, 2)` with LF line endings and a
  trailing newline.
- The filename is `<slug>.rookery.json`. The slug comes from the variant ID,
  falls back to its name and then to `variant`, uses only `a-z`, `0-9`, and `-`,
  and has at most 64 characters. Example: `the-long-walk.rookery.json`.

### Accepted import input

| Input | Handling |
| --- | --- |
| Envelope, version 1 | Validated as described below. |
| Bare `VariantDefinition` (root has `schemaVersion`, no `format`) | Accepted as legacy data. This is what the Sprint 1 "Download valid draft" button produced. |
| Envelope with a newer `envelopeVersion` | Rejected with `ENVELOPE_UNSUPPORTED_VERSION`. |
| Anything else | Rejected with `ENVELOPE_MALFORMED`. |

Variant schema versions 1 and 2 are both accepted unchanged. Loading never
upgrades a version 1 variant; the editor upgrades it only when the creator
selects a Sprint 2 objective, as documented in `packages/rules/README.md`.

## Validation order

Stored values and imported files pass through the same steps, stopping at the
first failing step. The last step reports every issue together.

1. Size: imports above `MAX_IMPORT_BYTES` (1 MiB) are rejected before the file is read.
2. Text: empty or whitespace-only input is rejected.
3. JSON: `JSON.parse` inside `try`/`catch`. Nothing is evaluated or dynamically imported.
4. Root type: must be a plain object, not an array, `null`, or a primitive.
5. Envelope: format, own keys, `migrateEnvelope`, and the schema-version match.
6. Variant structure: `parseVariantDefinition`; failures become `SCHEMA_INVALID` issues.
7. Variant semantics: `draftIssues`, the same gate that enables "Open playtest".

## Module API

All modules live in `src/features/draft-persistence/`.

```ts
// envelope.ts
export const DRAFT_STORAGE_KEY = "rookery.editor.draft";
export const ENVELOPE_FORMAT = "rookery.variant-draft";
export const ENVELOPE_VERSION = 1;
export const MAX_IMPORT_BYTES = 1_048_576;

export type DraftIssue = Readonly<{
  code: string;
  severity: "error" | "warning";
  message: string;
  path: readonly (string | number)[];
}>;

export type DecodeResult =
  | Readonly<{ ok: true; variant: VariantDefinition; source: "envelope" | "legacy-variant"; savedAt: string | null }>
  | Readonly<{ ok: false; code: DraftErrorCode; message: string; issues: readonly DraftIssue[] }>;

export type ExportResult =
  | Readonly<{ ok: true; fileName: string; text: string }>
  | Readonly<{ ok: false; code: "VARIANT_INVALID"; message: string; issues: readonly DraftIssue[] }>;

/** Parse + draftIssues gate; on success returns an independent canonical copy and its compact text. */
export function checkDraft(input: unknown):
  | Readonly<{ ok: true; variant: VariantDefinition; text: string }>
  | Readonly<{ ok: false; issues: readonly DraftIssue[] }>;
export function decodeEnvelope(raw: unknown): DecodeResult;
export function parseImportText(text: string, byteSize: number): DecodeResult;
export function exportDraft(variant: VariantDefinition): ExportResult; // refuses drafts with blocking issues
export function exportFileName(variant: Pick<VariantDefinition, "id" | "name">): string;

// storage.ts
export interface DraftStorage {
  read(key: string): string | null; // throws on failure
  write(key: string, value: string): void; // throws on failure, including quota errors
  remove(key: string): void;
}
export function browserDraftStorage(): DraftStorage | null; // null on the server or when blocked
export function createMemoryDraftStorage(options?: {
  quotaBytes?: number;
  unavailable?: boolean;
  initial?: Readonly<Record<string, string>>;
}): DraftStorage; // realistic adapter for tests; throws QuotaExceededError / SecurityError DOMExceptions

// repository.ts
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

export interface DraftRepository {
  load(): Promise<LoadResult>;
  save(variant: VariantDefinition): Promise<SaveResult>;
  clear(): Promise<ClearResult>;
  /** Treats a loaded, imported, or reset draft as already saved. */
  markBaseline(variant: VariantDefinition): void;
}

export function createDraftRepository(
  storage: DraftStorage | null,
  now?: () => Date,
): DraftRepository;
```

Repository guarantees:

- Browser storage is synchronous, so each operation completes in call order
  before its promise is returned. An earlier save can never finish after, and
  overwrite, a newer one, and a lifecycle flush writes before the page is hidden.
  A future asynchronous adapter must preserve the same ordering.
- `save` applies the same gate as playtest handoff (`checkDraft`). A draft with
  blocking issues returns `failed` with code `VARIANT_INVALID` and its issues,
  and the last valid stored copy is kept.
- A save whose canonical variant text matches the last written, restored, or
  baseline text returns `unchanged` without writing.
- `load` accepts only an envelope. A bare variant in storage is reported as
  `ENVELOPE_MALFORMED`; bare variants are accepted only through import.
- Blocked storage on load returns `unavailable` rather than `failed`: there is no
  stored value to diagnose, and the editor opens First Flight with autosave off.
- A failed load returns the raw stored text (at most `MAX_IMPORT_BYTES`
  characters) for diagnosis. The repository does not overwrite that value until
  the user edits, imports, or confirms a reset.
- Storage exceptions are mapped to the codes below and never escape as
  implementation errors.

### Hook, controls, and editor integration

```ts
// use-draft-persistence.ts (client only)
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

export function useDraftPersistence(repository?: DraftRepository):
  | Readonly<{ phase: "restoring" }>
  | Readonly<{
      phase: "ready";
      editorDraft: VariantDefinition; // what the editor mounts from
      editorKey: number;              // changes on reset, remounting all editor-local state
      editorMessage: string | undefined;
      status: SaveStatus;
      notice: RecoveryNotice | null;
      onDraftChange(draft: VariantDefinition): void; // schedules the debounced save
      handoff(): VariantDefinition;   // flushes, then keeps the latest draft for the next mount
      returnToEditor(): void;
      reset(): Promise<void>;         // clears storage, loads a fresh First Flight baseline
    }>;
```

- Without an injected repository, the hook creates one over
  `browserDraftStorage()` inside an effect, so nothing touches browser storage
  during server rendering.
- `phase: "restoring"` is returned until `load` settles. The workshop renders
  only a "Restoring your draft…" status in that phase, which is identical on the
  server and the first client render.
- The editor's initial `onDraftChange` call on mount is recognised by identity
  and ignored, so restoring or resetting never schedules a write by itself.

| `SaveStatus` | Text shown in "Your draft" |
| --- | --- |
| `idle` | "Autosave is on. Valid changes save in this browser." (or the last saved time) |
| `pending` | "Saving…" |
| `saved` | "Saved in this browser at HH:MM." |
| `invalid` | "Not saved: resolve N issues. Last valid draft kept (HH:MM)." |
| `error` | "Couldn't save: " followed by the error code's guidance |

```ts
// draft-controls.tsx
export function DraftControls(props: {
  draft: VariantDefinition; // the editor's current draft, used for export
  status: SaveStatus;
  notice: RecoveryNotice | null;
  onReset: () => Promise<void>;
}): JSX.Element;
```

`DraftControls` renders the "Your draft" region: a polite `role="status"` save
line, an **Export JSON** button, a **Reset draft** button confirmed through the shared `ConfirmChange`
dialog, a focused `role="alert"` recovery panel (with **Download stored data**
and **Reset saved draft**) for a failed load, and an "Autosave is off" notice
when storage is unavailable. It holds no draft state of its own.

**Export JSON** runs `exportDraft` only when clicked and downloads
`<slug>.rookery.json` as `application/json` through `downloadText` in
`download.ts`, the same helper used by "Download stored data". A draft with
blocking issues produces no file; a polite message says how many issues to
resolve, because export uses the same gate as playtest. The button stays
enabled and focusable so that explanation is always reachable. Exporting never
reads or writes browser storage.

Integration points (all additive and optional, so editor-only usage and tests
are unchanged):

| Component | Prop | Purpose |
| --- | --- | --- |
| `VariantEditor` | `onDraftChange?(variant)` | Called from an effect with every committed draft, including the initial one. |
| `VariantEditor` | `initialMessage?` | Replaces the default status message on mount, e.g. after restore or reset. |
| `VariantEditor` | `draftControls?: (draft) => ReactNode` | Render slot below the introduction, called with the current draft; the workshop renders `DraftControls`. |
| `VariantWorkshop` | `repository?: DraftRepository` | Replaces browser storage, e.g. with an in-memory repository in tests. |

`VariantWorkshop` mounts the editor with `key={editorKey}` and
`initialVariant={editorDraft}`. It calls `handoff()` before starting a playtest,
so a pending save is written and only the variant is persisted, and it clears
session-only piece tokens after `reset()`.

## Error codes

| Code | Raised by | Recovery guidance |
| --- | --- | --- |
| `STORAGE_UNAVAILABLE` | Storage blocked, private mode, or server render | Autosave is off; export to keep work. |
| `STORAGE_QUOTA_EXCEEDED` | Browser storage full | Free space or export; the in-memory draft is kept. |
| `STORAGE_READ_FAILED` | Unexpected read error | Reset or import a saved export. |
| `STORAGE_WRITE_FAILED` | Unexpected write error | Export to keep work; autosave retries on the next change. |
| `ENVELOPE_MALFORMED` | Wrong root type, unknown or missing keys, mismatched versions | Download the stored data, then reset or import. |
| `ENVELOPE_UNSUPPORTED_VERSION` | `envelopeVersion` from a newer release | Use the release that wrote it, or reset. |
| `IMPORT_TOO_LARGE` | File above 1 MiB | Choose a Rookery export. |
| `IMPORT_EMPTY` | Empty or whitespace-only file | Choose a Rookery export. |
| `IMPORT_NOT_JSON` | Text is not valid JSON | Choose a Rookery export. |
| `VARIANT_INVALID` | Structural or semantic variant issues | Each issue keeps its own validator code and field path, such as `SCHEMA_INVALID` at `board.files` or `INVALID_ROYAL_COUNT` at `players.0`. |

## Autosave and recovery

- **Debounce:** `AUTOSAVE_DELAY_MS = 600`. Each draft change restarts the timer.
- **Validity gate:** only drafts with no blocking `draftIssues` are saved. While
  a draft is invalid, the status reads "Not saved: resolve N issues", and the last
  valid saved draft is kept.
- **Change detection:** unchanged drafts are not written (see repository guarantees).
- **Flush:** a pending save is written immediately on `pagehide`, on
  `visibilitychange` to hidden, when the workshop unmounts (for example, when
  navigating home), before opening playtest, and after a successful import.
  Flushing on page unload is best-effort.
- **Initial draft:** the editor reports its starting draft on mount; that report
  is not treated as an edit, so loading or restoring never writes by itself.
- **After a failed recovery:** autosave is paused until the first real edit, so
  the unreadable stored value stays available for "Download stored data".
- **Stale results:** every change, import, reset, and undo increments a revision
  number. A load or save result is applied only if its revision is still current,
  so a late result can never replace a newer in-memory draft.
- **Status:** a non-intrusive polite live region shows restoring, saving, saved
  (with time), not saved (invalid), or a storage error with guidance.

| Recovery result | Behavior |
| --- | --- |
| `empty` | Load an independent copy of First Flight and mark it as the baseline. Nothing is written until the first edit. |
| `unavailable` | Load First Flight and show that autosave is off, with guidance to export. |
| `restored` | Start the editor from the restored draft and announce when it was saved. |
| `failed` | Load First Flight and show a focused alert with the code, a "Download stored data" button, "Reset saved draft", and a pointer to import. |

**Reset** requires confirmation. It clears the stored draft, loads a fresh
independent copy of First Flight, and marks it as the baseline. Cancelling
changes nothing.

**Import** never mutates anything until every validation step passes. A failed
import leaves the in-memory draft and the stored copy unchanged. A valid import
shows a summary, asks for confirmation when the current draft has unsaved edits,
replaces the draft with an independent canonical copy, saves it immediately,
and offers "Undo import" for the rest of the session.

## Migration extension point

`migrateEnvelope(raw)` in `envelope.ts` switches on `envelopeVersion`:

- Version `1` passes through unchanged.
- Any other version returns `ENVELOPE_UNSUPPORTED_VERSION`.

An incompatible envelope change must raise `ENVELOPE_VERSION`, add a case that
converts the previous version, and add round-trip tests for both. Variant
schema migrations belong to the rules package; S2-01 requires none, so this
feature implements none.

## Coordination with S2-03

The editor's blocking checks are composed in one function, `draftIssues` in
`src/features/variant-editor/model.ts`. It combines `validateVariantDefinition`,
the editor's supplemental `objectiveIssues`, and the duplicate-movement check.
The editor, autosave, recovery, and import all use it. When S2-03 moves those
rules into `validateVariantDefinition`, whichever pull request merges second
removes the supplemental checks from that one function.

The import and recovery UI renders any issue's code, path, and message
generically, so new S2-03 codes need no UI change. S2-07 tests assert only stable
Sprint 1 validator codes and this feature's own codes.

## Planned limitations

- Custom piece tokens are session-only, because the shared schema has no token
  field. They are not stored or exported.
- One draft slot per browser profile. With several tabs open, the last save wins.
- Saving when the page closes is best-effort and depends on browser lifecycle events.

## Verification

### Baseline

Recorded before any S2-07 change, from `main` at `35ab3ad` (merge of PR #18),
with `npm ci` followed by `npm run verify`.

Environment: Node v22.13.0, npm 11.0.0, Windows 11, Next.js 16.4.3 (Turbopack).

| Gate | Result |
| --- | --- |
| Repository hygiene | Passed for 126 tracked files |
| Lint (`eslint . --max-warnings=0`) | Pass |
| App and rules typechecks | Pass |
| Application tests (jsdom) | 11 files, 95 tests passed |
| Rules tests (Node) | 11 files passed, 1 skipped; 114 tests passed, 1 skipped (opt-in timing test) |
| Production build | Pass; routes `/`, `/editor`, `/api/health`, `/dev/board-surface`, `/icon.svg` |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Production smoke | Passed: `/api/health`, `/`, `/editor` |
| `git diff --check` | Pass |

The full `npm audit` reports eight moderate development-toolchain findings from
`minimatch` 7.0.0–11.0.0, unchanged from the earlier Sprint 2 baselines. npm's
forced remediation is a breaking ESLint change, so it is not applied here.
