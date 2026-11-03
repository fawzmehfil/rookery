# Sprint 1 variant editor (Task 05)

## State and integration boundary

The feature lives in `src/features/variant-editor`; `/editor` is a thin route.
The domain draft is exactly the public readonly `VariantDefinition`. Feature-local
state holds the selected square, palette player/type, selected movement type and
uncommitted form strings. Pure update functions return a new definition, or a
rejection without altering the original. No engine internals enter the editor.

`VariantEditor` accepts an optional `initialVariant: VariantDefinition` and an
optional `onPlaytest(variant: VariantDefinition)` callback. It calls the latter
only after parsing and semantic validation find no blocking issues. Without a
Task 07 callback, the editor offers a validated JSON download for the same exact
contract. This is a handoff boundary, not a second persistence format.

Tasks 04 and 06 are merged dependencies. The editor imports the shared
`BoardSurface` and validation contract directly from current `main`, with a narrow
adapter translating numeric coordinates to square names and player IDs to
presentation sides. There is one renderer for editor and playtest consumers.

## Interactions

- Select tool: activate a piece, then an empty destination to move it. An occupied
  destination selects that piece instead; moves never silently overwrite pieces.
- Place tool: choose player/type, then activate an empty square. Occupied squares
  are rejected; an explicit Replace tool updates the selected piece in place.
- Remove tool: activate a piece to remove it. Escape clears selection.
- Pointer clicks and keyboard Enter/Space use the same operations. The shared
  board supports arrow-key navigation with one tab stop.
- Disabled cells are visible and never accept placement. A separate labelled
  cell control can enable/disable a cell because the shared surface deliberately
  does not emit disabled-cell activations.
- Board resize stages dimensions first, lists destructive effects, and requires
  a separate confirmation before removing pieces or disabled cells.
- Movement changes target one type and one pattern. Text inputs stay local until
  a valid bounded rule can be committed. Existing semantically invalid drafts
  remain editable; all errors appear with field paths.

## Files and verification

- Route: `src/app/editor/page.tsx`; homepage workshop link enters `/editor`.
- Feature: `model.ts` contains pure immutable edits and the validated handoff;
  `board-adapter.ts` translates presentation coordinates; `movement-form.tsx`
  contains staged bounded inputs; `variant-editor.tsx` coordinates the controls.
- Board surface and root UI test configuration come from merged Task 06. Its
  existing tests are retained. The rules package keeps its separate Node Vitest
  configuration.
- `npm.cmd run check`: lint, app/rules type checks, 44 UI/model/board tests,
  87 rules tests, and the production build pass. One opt-in timing test skips in
  the ordinary run; enabling it passes separately.
- `npm.cmd audit --omit=dev`: zero vulnerabilities. Full `npm.cmd audit` still
  reports the 16 pre-existing moderate development-toolchain findings described
  in Task 04's validation notes; full-audit acceptance remains outstanding.
- `git diff --check`: passes.

Browser verification used 1440x1000 desktop and 390x844 narrow viewports. Both
pointer and keyboard movement work. Narrow layout stays inside the page width;
large boards scroll locally to keep cells usable. Confirmed resize warnings list
lost pieces before mutation; cancellation preserves the board. Removing a royal
blocks download and restoring it enables download. A real download contained the
exact nine-field shared definition, including the moved piece's original ID.

Screenshots are in `docs/evidence`: desktop, mobile destructive-resize confirmation,
and mobile validation errors. Keyboard operations use native labelled controls,
the shared board's roving tab stop and Enter/Space activation, and visible focus
outlines. Status messages announce operation results; the validation summary uses
field paths and links back to setup or movement controls.

## Known limitations and merge order

- Drafts live in this tab; no autosave or reload restoration is promised. Download
  valid drafts before leaving. Import, accounts and storage are outside this task.
- Forms stage changes until Save/Add. The readable preview and downloaded data
  always represent committed draft rules, not unfinished form input.
- Task 07 is not implemented here. Supply `onPlaytest` to integrate it; the route
  currently downloads a validated JSON definition instead of launching a game.
- The branch is based on the merged validation and board dependencies. No changes
  should be merged before approval and green CI.
- No task URL was supplied; add the Notion task link to the PR when available.
