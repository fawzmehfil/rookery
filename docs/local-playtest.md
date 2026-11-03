# Editor-to-playtest integration (Sprint 1 Task 07)

## Production data flow

```text
editor VariantDefinition
  → parseVariantDefinition
  → validateVariantDefinition
  → createInitialState
  → getLegalActions
  → applyAction legality gate
  → internal confirmed transition
  → returned GameState + EngineEvent[]
  → controlled BoardSurface and event panels
```

`VariantWorkshop` owns the current draft and whether `/editor` is showing the
editor or a local playtest. The draft remains the shared `VariantDefinition`; no
integration-specific copy or preview model exists. `createLocalSession` is the
framework-independent trust boundary. It parses the editor object, collects all
blocking semantic issues, and initializes state only after both checks pass.

The local session stores only the parsed variant, immutable initial/current engine
states, and the accepted action/event history. A rejected action returns its public
`EngineError` and leaves the complete session unchanged. Reset reuses the exact
validated initial state and clears history. Returning to the editor discards the
session while preserving the draft object handed off by the editor.

## UI authority and accessibility

The playtest derives selection targets from public `getLegalActions`. It submits
all proposed moves through public `applyAction` and renders only the returned state;
React never moves or captures a piece optimistically. Active player, turn, ply,
captures, ordered events, error code/details, and capture-the-royal outcome are
visible. Accepted moves, reset, return-to-editor, and game end clear selection.

Editor and playtest share `BoardSurface` and `variantBoardPieces`. Pointer and
keyboard activation follow the same action path. The board uses a roving tab stop,
arrow navigation, Enter/Space activation, visible focus, text in addition to color,
and a locked but readable terminal position.

## Removed or rejected mocks

The production path does not use the unmerged scripted chess session from the old
playtest branch. Its separate `PlaytestSnapshot`, `LegalAction`, `PlaytestEvent`,
side/turn model, and scripted legal moves are intentionally absent. Development
homepage/board previews remain isolated and do not enter `/editor`.

## Verification and limits

Automated coverage includes malformed and semantically invalid drafts, exact legal
and capture highlights, safe illegal-action rejection, accepted state/event/turn
updates, capture removal, deterministic replay, reset, draft preservation, the
complete First Flight royal-capture sequence, and its keyboard-only equivalent.
Desktop legal-target and 390×844 narrow-session evidence is stored in
`docs/evidence/playtest-desktop.png` and `docs/evidence/playtest-narrow.png`.

Recorded on Node 22.22.3 / macOS:

- `npm run check`: lint, application/rules typechecks, 55 application tests,
  95 ordinary rules tests, and the production build pass; one opt-in timing test
  is skipped by the ordinary rules run.
- Opt-in legal-action timing: 0.009035ms median per call on the fixed 26×26
  First Flight fixture, below the 100ms PoC limit.
- `npm audit --omit=dev`: zero vulnerabilities.
- `git diff --check`: passes.
- Full `npm audit` still reports the 16 pre-existing moderate `minimatch`
  development-toolchain findings. npm's proposed forced remediation is a breaking
  ESLint downgrade, so this integration PR does not apply it.

This remains an in-memory two-player local session. Autosave, import, authentication,
published variants, clocks, replay navigation, networking, and persistence are
deferred. The current engine intentionally omits royal safety, promotion, castling,
en passant, and other rules listed in `packages/rules/README.md`.
