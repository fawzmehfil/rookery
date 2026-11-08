# Sprint 2 objective editor and showcases

Task: objective editor and showcase starting points (Notion URL not supplied).
Branch: `rafael/objective-editor-showcases`, independently based on current main.

## State / board interaction before implementation

The exact shared `VariantDefinition` remains the sole domain draft. Selecting a
Sprint 2 objective upgrades schemaVersion to 2; First Flight stays version 1 until
an objective change requires version 2. Only one objective is present.

Three objective cards reveal conditional controls. Reach-target edits a clearly
identified player's target list with optional stable eligible-type IDs. A target
selection mode temporarily intercepts main-board activation before placement
logic; leaving the mode restores select/place/move/replace/remove. The same shared
board is reused. Persistent target rendering is coordinated with S2-06; this UI
shows an active-player banner, selected cell and labelled per-player target lists.

Discarding configured targets or an edited draft requires a separate explicit
confirmation. Resize/disabling operations reject changes that would invalidate
targets, with instructions to edit targets first. Supplemental editor diagnostics
use the same issue-path shape while S2-02 semantic validation is pending; no
outcome evaluator or alternate movement engine belongs in this task.

Showcase cards show descriptions, board size, objective and notable pieces.
Loading deep-copies a bundled fixture, resets editor-only selections and keeps
future edits independent. Three fixtures: First Flight, The Long Walk, Last Flock
Standing. Starting on a target never counts as victory; requireAction remains true.

## Verification

The common main baseline passes npm ci, lint/typecheck, 55 UI tests, 114 rules
tests and production build; one opt-in timing test skips. Full audit has eight
baseline moderate development findings. Final evidence/results follow here.

## Verified result

- `npm run verify` passes: hygiene, lint, app/rules types, 74 UI/model tests,
  114 rules tests (one opt-in timing test skipped), production build, clean
  production dependency audit, production health/editor smoke check and diff hygiene.
- All three fixtures parse, semantically validate, start local sessions, reset to
  their exact initial states and round trip deterministically. Fixture objects
  remain untouched; loads use deep independent copies.
- Desktop 1440x1000 and narrow 390x844 browser checks covered showcase loading,
  coordinate and keyboard board target selection, duplicate feedback, objective
  switch cancellation, dirty-showcase cancel/confirm, Last Flock Standing session
  entry/reset, return to editor, no horizontal overflow and no console errors.
- Screenshots: `evidence/sprint-2/objectives-desktop.png` and
  `evidence/sprint-2/objectives-narrow.png`.
- No dependency changes, catalog mutations or engine implementation changes.

## Exact public objective examples

```json
{"type":"capture-royal"}
```

```json
{"type":"reach-target","requireAction":true,"targets":[{"playerId":"white","cells":[{"file":0,"rank":2}],"eligiblePieceTypeIds":["runner"]},{"playerId":"black","cells":[{"file":2,"rank":0}],"eligiblePieceTypeIds":["runner"]}]}
```

```json
{"type":"eliminate-all"}
```

## Integration notes

Editor diagnostics supplement the schema and current semantic validator for
target ownership, cells, eligibility and elimination setup. Their paths match the
public data exactly; there is no objective translation at handoff. Reconcile the
supplement with S2-02's issue codes once that validator is merged. Target lists
have distinct per-player colors/names and the board-selection banner announces
the active owner. Persistent multi-target markers and playtest target rendering
remain S2-06 integration work; the existing shared renderer is unchanged here.

S2-04 supplies royal/type editing controls linked by the capture-royal guidance.
Both PRs independently start from main and meet in the same editor coordinator.
Persistence, publishing, multi-objective rules, outcome evaluation and victory UI
remain outside this task. The editor explicitly explains that new-objective
movement can be tested while automatic victory checking awaits the engine task.

New objective victory evaluation is owned by S2-02 and is absent on this baseline.
Loading and resetting engine sessions can be verified now; reach-target and
eliminate-all victory demonstrations remain pending that engine implementation.
