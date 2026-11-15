# Sprint 2 objective and victory presentation in playtest

Task: S2-06 — Present objectives and victories in playtest.
Branch: `ibrahim/objective-playtest-ui`, based on `main` after S2-02 (#23) and S2-07 (#20).
Depends on S2-01 (contracts and fixtures) and S2-02 (reach-target and eliminate-all outcomes).
Coordinates with S2-05 (target editing) and S2-08 (browser verification).

## Data flow

```text
LocalSession (parsed variant + engine GameState + accepted events)
  → objective-presentation.ts   formats configuration and engine output only
  → LocalPlaytest               renders panels, live region, and event log
  → BoardSurface                draws targets and highlights it is given
```

The playtest is still a controlled view. Legal highlights come from
`getLegalActions`, every move goes through `applyAction` via the local session,
and every victory message is built from `state.outcome` or a `game-ended`
event. Nothing in React decides target eligibility, captures, turns, or wins.

`objective-presentation.ts` is framework-free and holds all display text:

| Function | Source | Output |
| --- | --- | --- |
| `objectiveSummary` | `variant.objectives[0].type` | Title and one-sentence instructions |
| `playerTargets` | reach-target configuration | Per-player squares and "Any piece" or eligible type names |
| `boardTargets` | reach-target configuration and the selected piece | `BoardTarget[]` with owner labels |
| `remainingPieces` | current `GameState.pieces` | Per-player counts |
| `describeOutcome` | structured `GameOutcome` | Headline and detail for each `reason` |
| `describeEvent` | one `EngineEvent` | Event-log line, objective-aware for `game-ended` |
| `announceAcceptedAction` | events of one accepted action | One live-region sentence |

Piece and player names come from the variant's setup and player list by stable
ID, so events and outcomes keep their IDs while the UI shows names such as
"White Runner".

## Board targets

`BoardSurface` gains an optional `targets` prop (`{ square, side, label }[]`).
Without it the board renders exactly as before, so the editor board, movement
preview, and dev preview are unchanged. The editor board does not pass targets
yet. Its square names stay `"d2"` and similar, which S2-08's Playwright tests
match exactly.

- **Shape, not just colour.** The first player's targets use blue (`#416e8f`)
  corner brackets; the second player's use a brown (`#9b6127`) dashed ring. These
  match the per-player colours in the objective editor's target panels. Both
  carry a small flag glyph in opposite corners, away from the rank and file
  labels, and a light halo keeps them readable on dark squares.
- **Layering.** The marker is a child element between the square's `::before`
  (last move, selected, check) and `::after` (legal dot, capture wedges), and
  below the piece layer. Selection, legal and capture markers, focus rings, and
  piece art stay visible on a target cell. Disabled cells cannot hold targets;
  the editor and validator reject them upstream.
- **Accessible names.** The label follows the occupant and precedes move state,
  for example `a3, White Runner, White target, last move`. When a piece is
  selected the label adds `selected piece eligible` or `selected piece not
  eligible`, read from the configured owner and eligible types. It never says
  a move wins; only an engine outcome does.

## Playtest presentation

- **Before the first move:** the objective title and instruction appear under
  the variant name.
- **Reach-target:** a Targets panel lists each player's cells, the marker shape
  as a text legend, and "any piece can win" or the eligible type names.
- **Eliminate-all:** a Pieces remaining panel shows each player's count from the
  current engine state. A rejected action leaves it unchanged.
- **Live region:** the existing `role="status"` message announces one sentence
  per accepted action: the move, any capture, then the next player or the
  result. Examples: `White Chancellor moved a1 to a5, capturing Black
  Nightrider. Black to move.` and `White Runner moved a2 to a3. White won: White
  Runner reached target a3.` Rejections still use the `role="alert"` panel.
- **Terminal state:** the status card shows `<Winner> wins` with the trigger
  from the outcome (royal captured, piece and target reached, last piece
  captured), states that input is locked, and keeps the final board and event
  history. Board squares stay focusable but cannot be activated.
- **Reset** restores the exact initial session, clears selection, errors, and
  announcements, and leaves focus on the Reset button.
- **Return to editor** discards the session. The saved draft is unchanged
  (covered by a workshop test that compares stored drafts).
- **Capture the royal:** legal highlights, capture presentation, terminal lock,
  reset, keyboard navigation, and the First Flight sequence behave as before.
  The victory detail now also names the captured royal.

The objective editor's notice saying victory checking was "not available in
this build yet" was removed, since S2-02 made it inaccurate. It is a separate
commit so it can be dropped if S2-05 prefers to own it.

## Tests

| Area | File |
| --- | --- |
| Target markers for each owner, several targets, shared squares, names, precedence with selected/legal/capture/last move, activation and focus, no-target boards unchanged | `src/components/board-surface/board-surface.test.tsx` |
| Objective text, target summaries, eligibility labels, remaining counts, outcome and event text from real engine runs, no win text before an engine outcome | `src/features/local-playtest/objective-presentation.test.ts` |
| Introductions for all three objectives; Long Walk eligible win; ineligible and opposing-target moves that keep playing; Last Flock counts, rejection, final capture, lock, history; keyboard completion of both showcases; reset; controlled tests (piece on a target with no outcome shows no win, injected outcome is shown verbatim, every move goes through `applyAction`) | `src/features/local-playtest/objective-playtest.test.tsx` |
| First Flight pointer and keyboard regression | `src/features/local-playtest/local-playtest.test.tsx` |
| Win in playtest, return to editor, saved draft unchanged | `src/features/variant-workshop/objective-playtest-integration.test.tsx` |

Test-only data lives in `src/features/local-playtest/objective-test-fixtures.ts`:

- **Crossroads:** a 3×4 reach-target variant where an ineligible Guard reaches
  its own target and a Runner reaches the opposing target without ending the
  game.
- **Last Flock Standing:** a 7-ply White win found by searching with the engine.
  Every test replays it through the engine.

## Limitations

- Target markers are not shown on the editor board yet; the prop is ready when
  S2-05 and S2-08 agree on the new square names.
- Marker shape is chosen by player order (first player brackets, second player
  ring), matching the board adapter's white/black mapping. Only two-player games
  are supported.
- The playtest's general `.playtest button` style paints every board square
  white, so the checkered `--board-light`/`--board-dark` colours never show in
  playtest. This predates S2-06 (see `docs/evidence/playtest-desktop.png`) and
  is left alone here. The markers were checked visually only on the white
  playtest squares. The light halo meant for darker boards, such as the
  `/dev/board-surface` preview, has not been checked visually.
- No capture or victory animation is added; the existing piece glide already
  respects `prefers-reduced-motion`.

## Verification

Recorded on macOS, from branch `ibrahim/objective-playtest-ui`:

- `npm run verify` passes: repository hygiene, lint, app and rules typechecks,
  229 app tests (17 files), 135 rules tests (one opt-in timing test skipped),
  production build, `npm audit --omit=dev` with 0 vulnerabilities, standalone
  health/home/editor smoke test, and `git diff --check`.
- Baseline on `main` before changes: 189 app tests and 135 rules tests, all passing.
- Local Node was 23.7.0; CI runs the `.nvmrc` version (22).

Browser checks, in Chrome against `next dev`, with a cleared draft:

- Desktop 1440 px and narrow 390 px. The narrow layout was measured in a 390 px
  same-origin frame, because the Chrome window cannot be made that narrow.
  Document scroll width equalled the viewport at both sizes.
- Played all three showcases to their conclusions. Checked the status card, the
  live-region sentence, remaining counts, event history, locked board, and reset.
- Ran a Long Walk move with real key presses (Enter, ArrowUp, Enter). Focus
  stayed on the destination square with a visible ring, and the move was
  announced.
- Saw a target cell with selection and a legal-move dot drawn together.
- No console errors through a full Last Flock Standing game and reset.

Evidence in `docs/evidence/sprint-2/`:

| Showcase | Desktop | Narrow |
| --- | --- | --- |
| First Flight (capture the royal) | `playtest-first-flight-desktop.png` | `playtest-first-flight-narrow.png` |
| The Long Walk (reach a target) | `playtest-long-walk-desktop.png` | `playtest-long-walk-narrow.png` |
| Last Flock Standing (eliminate all) | `playtest-last-flock-desktop.png` | `playtest-last-flock-narrow.png` |
