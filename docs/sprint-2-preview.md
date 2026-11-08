# Combined Sprint 2 editor preview

This local integration combines the two independent task branches without merging
either into main. The review units remain PR #17 (visual library) and PR #18
(objectives/showcases), both based on main.

```powershell
git switch codex/sprint-2-editor-preview
npm.cmd run dev
```

Open `/editor`. Add piece type opens search and custom creation. Objective settings
opens win-condition configuration; showcase cards load independent examples.
The main board stays the single shared BoardSurface. Target-selection mode is
cleared when adding a piece type, so subsequent activations place pieces rather
than accidentally changing targets. Showcase loading resets selections, the
designer, and session token overrides.

## Combined verification

`npm run verify` passes with 95 UI/model/integration tests and 114 rules tests
(209 total; one opt-in performance test skipped), lint, app/rules type checks,
production build, production audit, production smoke checks and diff hygiene.
Production audit is clean; full audit retains eight baseline moderate development
findings. No new dependencies were introduced.

The integration test creates a Unicorn in The Long Walk, places it, restricts
White's eligible target type to Unicorn, starts playtest, returns to the editor,
and confirms replacement with First Flight. Browser verification also switches
from White target mode to adding/placing a Bishop, proving placement and objective
selection do not interfere. No new console errors occur after reconciliation.

## Scope limits

New objective outcome evaluation is pending S2-02. Movement sessions start/reset,
but reach-target and elimination victory demonstrations cannot yet pass against
this main baseline. Target marker rendering in playtest is coordinated with S2-06.
Custom tokens survive editor/playtest transitions within this session but are not
serialized: the public strict schema has no appearance field. No persistence,
publishing or new engine mechanics were added.

See `sprint-2-piece-library.md` and `sprint-2-objectives.md` for detailed interaction
decisions, exact contract examples, screenshots and per-branch verification.
