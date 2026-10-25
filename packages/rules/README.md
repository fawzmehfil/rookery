# `@rookery/rules`

Framework-independent contracts and deterministic rules for Rookery variants.

## Boundaries

- Coordinates are zero-based `{ file, rank }` values. UI adapters may translate them to labels such as `a1`.
- Variant data must pass `parseVariantDefinition` before entering the engine.
- Runtime parsing guarantees data shape. Cross-reference checks and contradictory-rule diagnostics belong to semantic validation.
- `RulesEngine` defines the final public engine surface. Legal-move generation and public action validation are intentionally separate from the confirmed-action transition kernel.
- Engine behavior must not depend on React, Next.js, browser APIs, clocks, randomness, or mutable global state.

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
