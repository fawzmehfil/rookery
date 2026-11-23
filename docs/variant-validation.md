# Semantic validation and engine quality

## Consumer boundary

`validateVariantDefinition(input: unknown): readonly ValidationIssue[]` is exported
from `@rookery/rules`. Each issue has `code`, `severity`, `message`, and a path of
string/number segments into the shared `VariantDefinition`. No translation is
needed by editor or playtest. Keep the draft on errors; block handoff whenever
`issues.some(issue => issue.severity === "error")`. Warnings are non-blocking.

The existing parser handles shape, schema-version-specific objectives, bounded coordinates,
primitive slide directions, adjacent step offsets, nonzero vectors, frames,
capture modes, and distances. Parser failures become `SCHEMA_INVALID` issues at
their original paths. Semantic traversal starts only after parsing succeeds.
Input is ordinary serialized data, never executable user rules.

Schema version 1 accepts only capture-the-royal. Version 2 also accepts
reach-target and eliminate-all definitions. Parsing never silently upgrades
version 1 data. Objective-specific semantic rules are centralized in the shared
validator; the objective editor projects the relevant shared issues instead of
maintaining a second validation implementation.

Semantic errors accumulate deterministically: duplicate player/type/piece IDs;
turn-order duplicates, unknown players and missing players; disabled cells in
array order; placements in array order; per-player objective requirements; then
initial-action availability when no preceding errors exist. Unused-type warnings
are appended last. IDs are unique within their own namespace, not globally.

## Stable codes

| Code | Path | Severity |
| --- | --- | --- |
| SCHEMA_INVALID | Parser's exact field path | error |
| DUPLICATE_PLAYER_ID | players[index].id | error |
| DUPLICATE_PIECE_TYPE_ID | pieceTypes[index].id | error |
| DUPLICATE_PIECE_ID | setup[index].id | error |
| TURN_ORDER_UNKNOWN_PLAYER | turnOrder[index] | error |
| TURN_ORDER_DUPLICATE_PLAYER | turnOrder[index] | error |
| TURN_ORDER_MISSING_PLAYER | players[index].id | error |
| DISABLED_CELL_OUT_OF_BOUNDS | board.disabledCells[index] | error |
| DUPLICATE_DISABLED_CELL | board.disabledCells[index] | error |
| UNKNOWN_PIECE_TYPE | setup[index].typeId | error |
| UNKNOWN_OWNER | setup[index].ownerId | error |
| PIECE_OUT_OF_BOUNDS | setup[index].at | error |
| PIECE_ON_DISABLED_CELL | setup[index].at | error |
| OVERLAPPING_PIECES | setup[index].at | error |
| INVALID_ROYAL_COUNT | players[index] | error |
| NO_CAPTURE_MOVEMENT | players[index] | error |
| NO_TARGET | players[index] | error |
| UNKNOWN_TARGET_PLAYER | objectives[0].targets[index].playerId | error |
| DUPLICATE_TARGET_PLAYER | objectives[0].targets[index].playerId | error |
| TARGET_OUT_OF_BOUNDS | objectives[0].targets[index].cells[index] | error |
| TARGET_DISABLED | objectives[0].targets[index].cells[index] | error |
| DUPLICATE_TARGET_CELL | objectives[0].targets[index].cells[index] | error |
| UNKNOWN_ELIGIBLE_PIECE_TYPE | objectives[0].targets[index].eligiblePieceTypeIds[index] | error |
| DUPLICATE_ELIGIBLE_PIECE_TYPE_ID | objectives[0].targets[index].eligiblePieceTypeIds[index] | error |
| NO_ELIGIBLE_PIECES | objectives[0].targets[index] | error |
| PIECE_INITIALIZED_ON_TARGET | setup[index].at | error |
| NO_INITIAL_PIECES | players[index] | error |
| NO_INITIAL_ACTIONS | turnOrder[0] | error |
| UNUSED_PIECE_TYPE | pieceTypes[index] | warning |

## Reproduction

Use Node 22 and npm 10+. From the repository root:

```powershell
npm.cmd run check
$env:ROOKERY_PERF = '1'
npm.cmd exec --workspace @rookery/rules -- vitest run src/legal-actions.performance.test.ts src/validate-variant.performance.test.ts --reporter=verbose --disableConsoleIntercept
Remove-Item Env:ROOKERY_PERF
npm.cmd audit
git diff --check
```

No property-testing dependency is added. The suite uses exhaustive deterministic
target-cell combinations, adversarial imports, and the canonical First Flight
replay, so it needs no random seed. Performance is opt-in to avoid timing-sensitive
ordinary CI. The legal-action fixture uses First Flight on a 26x26 board. The
validator fixture uses all 128 piece types and all 676 board cells with disjoint
per-player targets. Both require a median per-call duration of at most 100ms.

## Recorded verification

- Node v22.23.4, Windows 10.0.26200, Intel Core Ultra 9 386H.
- Lint, app and rules type checks, and production build pass.
- Ordinary rules suite: 87 passing tests; one opt-in performance test skipped.
- Opt-in rules suite: 88 passing tests. Recorded median 0.008352ms/call before the final validator-only refinement.
- First Flight parses, validates with `[]`, and round trips through JSON.
- On Node 22.22.2 and Apple M2, the maximum reach-target validator fixture
  recorded a 3.49ms median per call; legal-action generation recorded 0.009ms.
- `npm audit`: 16 moderate development-toolchain findings from existing
  minimatch dependencies. No production dependency findings. Not fixed with
  `--force`: npm proposes a breaking ESLint downgrade. Audit is an outstanding
  acceptance item requiring a coordinated dependency update.

## Limits and dependencies

Task 07 adds public `applyAction`. It preserves the confirmed kernel's structured
precondition errors, rejects well-formed movement-illegal input as
`ACTION_NOT_LEGAL`, and invokes the transition kernel only after an exact match in
the current `getLegalActions` result. The confirmed kernel remains internal.
No new public transition API is introduced here.

For capture-the-royal, validation checks structural contradictions, objective royal counts, each player's
capture capability (including whether any capture vector can land on a playable
cell anywhere on the board) and whether the starting player has legal actions. It does not
solve arbitrary future game reachability, guarantee a forced win, or add stalemate
rules absent from Sprint 1's capture-the-royal contract.

Capture capability is evaluated once per player and placed piece type. Board-vector
landability is cached across types, bounding validation even when a definition uses
the maximum setup and repeated movement vectors. The ordinary suite includes a
675-piece adversarial fixture with maximum movement-pattern and vector counts.
