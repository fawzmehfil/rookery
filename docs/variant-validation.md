# Semantic validation and engine quality (Sprint 1 Task 04)

## Consumer boundary

`validateVariantDefinition(input: unknown): readonly ValidationIssue[]` is exported
from `@rookery/rules`. Each issue has `code`, `severity`, `message`, and a path of
string/number segments into the shared `VariantDefinition`. No translation is
needed by editor or playtest. Keep the draft on errors; block handoff whenever
`issues.some(issue => issue.severity === "error")`. Warnings are non-blocking.

The existing parser handles shape, supported objectives, bounded coordinates,
primitive slide directions, adjacent step offsets, nonzero vectors, frames,
capture modes, and distances. Parser failures become `SCHEMA_INVALID` issues at
their original paths. Semantic traversal starts only after parsing succeeds.
Input is ordinary serialized data, never executable user rules.

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
| NO_INITIAL_ACTIONS | turnOrder[0] | error |
| UNUSED_PIECE_TYPE | pieceTypes[index] | warning |

## Reproduction

Use Node 22 and npm 10+. From the repository root:

```powershell
npm.cmd run check
$env:ROOKERY_PERF = '1'
npm.cmd exec --workspace @rookery/rules -- vitest run src/legal-actions.performance.test.ts --reporter=verbose --disableConsoleIntercept
Remove-Item Env:ROOKERY_PERF
npm.cmd audit
git diff --check
```

No property-testing dependency is added. The suite uses deterministic tables and
the canonical nine-action First Flight replay, so it needs no random seed.
Performance is opt-in to avoid timing-sensitive ordinary CI. The fixed fixture
is First Flight's six pieces on a 26x26 board; 100 warm-up calls precede nine
samples of 100 calls each. The median per-call duration must be at most 100ms.
This establishes PoC latency for this fixture, not a worst-case guarantee for
every user-authored variant.

## Recorded verification

- Node v22.23.4, Windows 10.0.26200, Intel Core Ultra 9 386H.
- Lint, app and rules type checks, and production build pass.
- Ordinary suite: 86 passing tests; one opt-in performance test skipped.
- Opt-in suite: 87 passing tests. Recorded median 0.008352ms/call before the final validator-only refinement.
- First Flight parses, validates with `[]`, and round trips through JSON.
- `npm audit`: 16 moderate development-toolchain findings from existing
  minimatch dependencies. No production dependency findings. Not fixed with
  `--force`: npm proposes a breaking ESLint downgrade. Audit is an outstanding
  acceptance item requiring a coordinated dependency update.

## Limits and dependencies

Main does not yet export public `applyAction`. Transition quality tests therefore
exercise the existing confirmed-action kernel, explicitly check movement legality
first, and test only its documented rejection cases. Full public illegal-action
assertions must be connected when Task 03's public implementation is available.
No new public transition API is introduced here.

Validation checks structural contradictions, objective royal counts, each player's
capture capability (including whether any capture vector can land on a playable
cell anywhere on the board) and whether the starting player has legal actions. It does not
solve arbitrary future game reachability, guarantee a forced win, or add stalemate
rules absent from Sprint 1's capture-the-royal contract.
