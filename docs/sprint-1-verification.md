# Sprint 1 verification report

This report records the release-candidate checks for the integrated Sprint 1
flow: edit a variant, pass shared validation, and immediately play it through
the deterministic rules engine. Task 8 is stacked on the Task 7 integration
branch and must be retargeted to `main` after that dependency is merged.

## Release gate

The repository has one local and CI release command:

```bash
npm ci
npm run verify
```

It verifies repository hygiene, lint, application and rules typechecking, all
ordinary tests, a production build, production dependency audit, standalone
server startup, `/api/health`, `/`, `/editor`, and whitespace errors.

Verified from a clean detached checkout on Node 22 before the pull request was
opened. The final result was:

- 55 application tests passed.
- 95 rules tests passed; the opt-in performance test is excluded from the
  ordinary suite and was run separately.
- The Next.js production and standalone builds completed.
- The production audit reported zero vulnerabilities.
- The standalone health, landing, and editor smoke checks passed.
- Repository hygiene and `git diff --check` passed.

## End-to-end matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Editor | Resized First Flight from 5×5 to 6×5, placed an extra tower, changed an owner-relative movement rule, and retained the exact draft while navigating to playtest and back | Pass |
| Structural and semantic errors | Removing a royal produced a readable validation error and disabled playtest; restoring it recovered without a reload | Pass |
| Legal actions | Step, sliding, and leaping pieces produced engine-owned targets; blocked paths and illegal destinations were rejected without changing state | Pass |
| Deterministic transitions | Turns, ordinary captures, event order, reset, and terminal-state locking matched the shared engine | Pass |
| Victory | The documented nine-ply First Flight sequence captured the black royal and ended with White winning | Pass |
| Accessibility | The canonical sequence was completed with arrows plus Enter/Space; Escape cleared selection; controls retained readable focus and labels | Pass |
| Responsive layout | Desktop at 1440×1000 and narrow at 390×844 had no horizontal overflow and kept the full playtest usable | Pass |
| Browser surface | Full pointer and keyboard flows passed in Chrome 157 and Brave 155 with no page or console errors | Pass |
| Local boundary | Return-to-editor preserved the in-memory draft; refresh reset it to bundled First Flight as documented | Pass |
| Production runtime | Standalone Node server returned healthy JSON and HTML for the landing and editor routes | Pass |

Chrome and Brave are both Chromium-based. A distinct engine is deferred rather
than claimed as covered by this release candidate.

## Performance and security

On Node 22.22.3, macOS 26.5.1, and an Apple M2, the opt-in 26×26 First Flight
legal-action benchmark had a median of **0.008835 ms per call**, well inside the
100 ms proof-of-concept budget. The command is reproducible:

```bash
ROOKERY_PERF=1 npm exec --workspace @rookery/rules -- \
  vitest run src/legal-actions.performance.test.ts \
  --reporter=verbose --disableConsoleIntercept
```

`npm audit --omit=dev` reports zero vulnerabilities. The full development audit
reports 16 moderate `minimatch` findings inherited through the ESLint toolchain.
The offered forced rewrite installs an incompatible ESLint major, so it was not
applied. This is a development-only baseline to revisit when the upstream lint
packages publish a compatible resolution.

The active GitHub ruleset **Protect main — owner updates only** covers `main`,
blocks updates, deletion, and non-fast-forward changes, and grants its sole
bypass to the repository owner. The pull request remains unmerged for owner
review.

## Defects fixed during hardening

1. The Docker dependency stage ran `npm ci` before copying the rules workspace
   manifest. The manifest is now copied first, and repository verification
   guards that order.
2. CI only ran the general code check. It now uses the same full delivery gate
   as local verification, including repository hygiene, production audit, and
   standalone startup smoke.
3. CI had no timeout or cancellation policy and used older action runtimes. It
   now cancels superseded runs, has a 15-minute ceiling, and pins current
   official checkout and Node setup releases.
4. Setup, package-layout, persistence, and milestone documentation was stale.
   The README, deployment notes, and demo checklist now describe the delivered
   system and its actual boundaries.

The Docker CLI was available but its local daemon was not running during the
release check, so an image build is not represented as passed. The Dockerfile
ordering regression is covered statically, while the equivalent clean npm
install and standalone production runtime were exercised directly.

## Evidence and fallback

- [Desktop victory state](evidence/sprint-1-desktop.png)
- [Narrow initial playtest](evidence/sprint-1-narrow.png)
- [Ten-second backup recording](evidence/sprint-1-backup.mp4)
- [Repeatable live demo](sprint-1-demo.md)

## Explicit Sprint 2 deferrals

- Durable local or server-backed draft persistence and JSON import/export.
- Accounts, publishing, gallery/search, remix attribution, and moderation.
- Authoritative WebSocket multiplayer, reconnection, spectators, clocks, and
  game history.
- Additional objectives, abilities, board mechanics, and global modifiers.
- A maintained cross-engine browser automation job and hosted preview gate.
