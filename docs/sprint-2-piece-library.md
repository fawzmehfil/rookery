# Sprint 2 visual piece library

Task: visual piece library and guided movement designer (Notion URL not supplied).
Branch: `rafael/visual-piece-library`, based on Sprint 2 contracts in main.

## Interaction sketch and state boundary

Desktop: [placement palette] [shared main board] [selected type / movement designer].
Add piece type opens a modal library: search + category filters, illustrated cards,
then a larger preview and Customize/Add. Blank custom pieces enter the same creator.
Narrow: one column, scrollable modal, compact movement designer rather than an
unbounded offset list beside the main board.

The domain draft remains exactly `VariantDefinition`. Templates are deep copied
with collision-free IDs. Selection and modal state are feature local. Chosen
tokens are session presentation settings, because the public strict piece schema
contains no icon/token field; no private fields are written into serialized data.
Name and royal status are public piece-type fields. Preview geometry comes from
the public `getLegalActions`, never a second movement engine.

The centered designer edits the same ordered `MovementPattern[]` as the advanced
numeric controls. Valid visual operations preserve frame, capture behavior and
unrelated fields. Invalid numeric drafts stay editable and block playtest.
Removing a type confirms the exact placement count and removes its placements
only on explicit approval. Catalog, fixtures and unrelated types are never mutated.

## Verification

Baseline and final results, screenshots, contract examples and limitations will
be recorded before review. No objectives, persistence or engine mechanics belong
to this PR. Existing engine limitations (Pawn first move/promotion/en passant and
castling) remain in effect.
