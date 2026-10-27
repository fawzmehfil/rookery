# `@rookery/rules`

Framework-independent contracts and deterministic rules for Rookery variants.

## Boundaries

- Coordinates are zero-based `{ file, rank }` values. UI adapters may translate them to labels such as `a1`.
- Variant data must pass `parseVariantDefinition` before entering the engine.
- Runtime parsing guarantees data shape. Cross-reference checks and contradictory-rule diagnostics belong to semantic validation.
- `RulesEngine` defines the final public engine surface. Legal-move generation and public action validation are intentionally separate from the confirmed-action transition kernel.
- Engine behavior must not depend on React, Next.js, browser APIs, clocks, randomness, or mutable global state.

## Legal actions

`getLegalActions(variant, state)` returns every movement-legal `MoveAction` for the active player. It does not apply actions; callers compare a proposed action against this list before the confirmed-action kernel runs.

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
