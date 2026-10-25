# `@rookery/rules`

Framework-independent contracts and deterministic rules for Rookery variants.

## Boundaries

- Coordinates are zero-based `{ file, rank }` values. UI adapters may translate them to labels such as `a1`.
- Variant data must pass `parseVariantDefinition` before entering the engine.
- Runtime parsing guarantees data shape. Cross-reference checks and contradictory-rule diagnostics belong to semantic validation.
- `RulesEngine` defines the final public engine surface. Legal-move generation and public action validation are intentionally separate from the confirmed-action transition kernel.
- Engine behavior must not depend on React, Next.js, browser APIs, clocks, randomness, or mutable global state.
