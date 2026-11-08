# `@rookery/rules`

Framework-independent contracts and deterministic rules for Rookery variants.

## Boundaries

- Coordinates are zero-based `{ file, rank }` values. UI adapters may translate them to labels such as `a1`.
- Variant data must pass `parseVariantDefinition` before entering the engine.
- Runtime parsing guarantees data shape. Cross-reference checks and contradictory-rule diagnostics belong to semantic validation.
- `RulesEngine` defines the final public engine surface. Legal-move generation and public action validation are intentionally separate from the confirmed-action transition kernel.
- Engine behavior must not depend on React, Next.js, browser APIs, clocks, randomness, or mutable global state.

## Schema versions and objectives

- Schema version 1 remains the immutable Sprint 1 contract and supports only `capture-royal`.
- Schema version 2 adds the `reach-target` and `eliminate-all` objective definitions while continuing to accept `capture-royal`.
- `objectives` remains a one-item array in version 2. Combining objectives is intentionally deferred.
- `reach-target` stores two player-target entries, one or more cells per entry, optional eligible piece-type IDs, and `requireAction: true`. An initial placement on a target does not win; S2-02 evaluates only an accepted action that enters a target.
- `eliminate-all` is a marker objective for the two-player game. S2-02 owns its transition and outcome behavior.
- Parsing never silently upgrades version 1 data. An editor may explicitly create a version 2 draft when the creator selects a current objective; catalog-only changes can preserve the document version when their ordinary movement data is already compatible.
- Future incompatible document changes require a new schema version and an explicit migration function. Published definitions and games must keep their original serialized version.

The engine currently evaluates `capture-royal`. Until S2-02 lands, current objectives parse, initialize safely, and return no inferred outcome rather than being misinterpreted as royal capture.

## Piece-template catalog

`pieceTemplateCatalog` exports immutable, framework-independent presets for Sovereign/King, Tower/Rook, Bishop, Queen, Hopper/Knight, Pawn, Chancellor/Empress/Marshal, Archbishop/Cardinal/Princess, Amazon, Centaur/General, Wazir, Ferz, Alfil, Dabbaba, Camel, Zebra, and Nightrider.

- Templates are ordinary movement data plus discovery metadata: stable ID, primary name, aliases, description, category, tags, token fallback, and default royal flag.
- `createPieceTypeFromTemplate` returns a fresh validated copy. Variants never retain a live reference to catalog state, and engine behavior never branches on template names.
- Symmetric templates are board-relative and default to `move-or-capture`. Pawn is owner-relative with a forward `move-only` step and diagonal `capture-only` steps.
- Compound pieces contain the union of component patterns; they still receive one action per turn.
- Nightrider uses ordinary slide directions based on every oriented knight vector, so occupied landing points block its ray normally.
- Hurdle/screen captures, locust/rifle capture, teleporting, swapping, multi-action pieces, promotion, castling, and en passant require future reviewed contracts and are not catalog presets.

## Legal actions

`getLegalActions(variant, state)` returns every movement-legal `MoveAction` for the active player. `applyAction(variant, state, action)` is the safe public mutation path: it reports generic state/action errors, confirms an exact match in the current legal-action set, and only then invokes the internal confirmed-action kernel. An otherwise well-formed illegal move returns `ACTION_NOT_LEGAL`; rejected actions never change state.

- **Frames:** `board` vectors are used as written. `owner` vectors are written from the owner's side: `rankDelta` is multiplied by the player's `forwardRank`, and `fileDelta` is unchanged (a vertical flip, not a 180° rotation).
- **Steps and leaps** land directly on their offset. Leaps ignore intervening cells.
- **Slides** walk each direction one cell at a time, up to `maxDistance` when set, and stop at the board edge, a disabled cell, or the first occupied cell.
- **Modes:** `move-only` lands only on empty cells, `capture-only` only on opposing pieces, and `move-or-capture` on either. Friendly pieces always block and are never captured.
- **Order:** pieces in `state.pieces` order, then movement patterns in definition order, then offsets or directions in definition order, then increasing slide distance. A destination reached by several patterns appears once, at its first position.
- **No actions:** a finished game, or a state whose `variantId` does not match the variant, returns an empty list.
- **Output:** the returned list, each action, and each coordinate are frozen. Inputs are never mutated.

### Assumptions and unsupported configurations

- States are expected to come from `createInitialState` and the engine's own transitions. Games are strictly two-player, so every piece's `ownerId` is one of the variant's players and every `typeId` is a defined piece type. Pieces that break this are not reported as errors; they simply produce no actions.
- Royal safety is not considered. Moves that leave a royal capturable are legal, because the objective is capturing the royal.
- Not supported: hopping captures that need a screen piece, first-move-only or conditional movement, promotion, castling, en passant, drops, and multi-step or multi-piece actions. Variants cannot express these with the current schema.

## Canonical fixture

`@rookery/rules/fixtures` exports the serialized **First Flight** variant. It is a small 5×5 integration target with a sovereign, tower, and hopper for each player.

Its demonstration sequence is:

1. White tower `a1 → a4`
2. Black hopper `a5 → b3`
3. White sovereign `c1 → b2`
4. Black sovereign `c5 → b5`
5. White tower `a4 → b4`
6. Black tower `e5 → e2`
7. White tower `b4 → b3`, capturing the black hopper
8. Black tower `e2 → e1`, capturing the white hopper
9. White tower `b3 → b5`, capturing the black sovereign and winning

## Sprint 2 contract fixtures

- **The Long Walk** is a 3×3 owner-relative race with mirrored `reach-target` configuration. White's runner demonstrates `a1 → a2 → a3`; Black has the mirrored target on `c1`.
- **Last Flock Standing** is a 5×5 `eliminate-all` fixture using Chancellor, Camel, and Nightrider catalog data.

These fixtures establish serialized contracts only. Their new victory behavior belongs to S2-02.
