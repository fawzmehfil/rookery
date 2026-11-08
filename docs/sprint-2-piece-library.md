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

Baseline: `npm ci` and `npm run check` passed with 55 UI/model tests and 114 rules
tests (one opt-in performance test skipped). Final library suite: 75 UI/model
tests plus the unchanged 114 rules tests pass; lint, app/rules typechecks and
production build pass. `npm run audit:production` reports zero vulnerabilities;
full audit retains eight moderate baseline development-toolchain findings.
No dependencies or lockfile changes were introduced.

Browser checks at 1440x1000 and 390x844 covered Empress -> Chancellor discovery,
preview/add/place, blank Unicorn creation with all knight orientations, keyboard
placement, shared engine legal capture and royal victory, return to editor,
Escape closing the library, and focus restoration to Add piece type. The narrow
page did not overflow horizontally. Evidence: `evidence/sprint-2/library-desktop.png`
and `evidence/sprint-2/creator-narrow.png`.

Example exact custom movement (the piece remains a normal public piece type):

```json
{"id":"unicorn","name":"Unicorn","royal":false,"movements":[{"kind":"slide","frame":"board","mode":"move-or-capture","directions":[{"fileDelta":1,"rankDelta":1},{"fileDelta":-1,"rankDelta":1},{"fileDelta":1,"rankDelta":-1},{"fileDelta":-1,"rankDelta":-1}]}]}
```

## Limits and integration

No objectives, persistence or engine mechanics belong to this PR. Pawn first
move/promotion/en passant and castling remain deferred. Diagram windows show four
cells each way; exact vectors up to 25 remain supported in Advanced even if their
destinations are outside that window. Capture-only geometry is illustrated on an
empty-board probe with capture highlights; real playtest occupancy/legality always
comes from the engine. The strict shared schema has no token field, so custom
tokens are session-only presentation and are not part of JSON serialization.
This contract limitation needs coordination before persistent custom artwork.

The existing S2-01 catalogs/fixtures and Node rules test project are unchanged.
The numeric form is now a synchronized disclosure within the selected-type
designer. Invalid advanced data is retained in the draft, excluded from preview
queries and blocks handoff until corrected. Independent template instances retain
their own stable IDs, ordered vectors, frame, behavior and unrelated data.
