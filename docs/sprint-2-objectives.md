# Sprint 2 objective editor and showcases

Task: objective editor and showcase starting points (Notion URL not supplied).
Branch: `rafael/objective-editor-showcases`, independently based on current main.

## State / board interaction before implementation

The exact shared `VariantDefinition` remains the sole domain draft. Selecting a
Sprint 2 objective upgrades schemaVersion to 2; First Flight stays version 1 until
an objective change requires version 2. Only one objective is present.

Three objective cards reveal conditional controls. Reach-target edits a clearly
identified player's target list with optional stable eligible-type IDs. A target
selection mode temporarily intercepts main-board activation before placement
logic; leaving the mode restores select/place/move/replace/remove. The same shared
board is reused. Persistent target rendering is coordinated with S2-06; this UI
shows an active-player banner, selected cell and labelled per-player target lists.

Discarding configured targets or an edited draft requires a separate explicit
confirmation. Resize/disabling operations reject changes that would invalidate
targets, with instructions to edit targets first. Supplemental editor diagnostics
use the same issue-path shape while S2-02 semantic validation is pending; no
outcome evaluator or alternate movement engine belongs in this task.

Showcase cards show descriptions, board size, objective and notable pieces.
Loading deep-copies a bundled fixture, resets editor-only selections and keeps
future edits independent. Three fixtures: First Flight, The Long Walk, Last Flock
Standing. Starting on a target never counts as victory; requireAction remains true.

## Verification

The common main baseline passes npm ci, lint/typecheck, 55 UI tests, 114 rules
tests and production build; one opt-in timing test skips. Full audit has eight
baseline moderate development findings. Final evidence/results follow here.

New objective victory evaluation is owned by S2-02 and is absent on this baseline.
Loading and resetting engine sessions can be verified now; reach-target and
eliminate-all victory demonstrations remain pending that engine implementation.
