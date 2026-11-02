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

Task 04 is draft PR #12. This branch is stacked on it until that PR merges.
Task 06 is open PR #6. The exact shared `BoardSurface` implementation and its
test tooling are reused from that PR, with a narrow adapter translating numeric
coordinates to square names and player IDs to presentation sides. Reconcile those
shared files with PR #6 before merge; do not maintain a second renderer.

## Planned interactions

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

## Delivery status

Implementation and verification results will be recorded here before review.
No task URL was supplied; link the Notion task in the PR when available.
