# Sprint 2 verification report

Task: S2-08 — Verify and deploy the hosted Sprint 2 demo.

This report maps the Sprint 2 demo flow to evidence. Rows marked **Pending**
have not been checked yet and say what they wait on. Nothing is marked Pass
without a recorded run.

## Build under test

| Item | Value |
| --- | --- |
| Integrated base commit | `803b4ac` on `main` (S2-01, S2-02, S2-04, S2-05, S2-06, S2-07 merged) |
| Not yet merged | S2-03 (objective validation and engine hardening). Re-run this report after it lands. |
| Hosted preview URL | <https://rookery-omega.vercel.app> |
| Preview deployment commit | **Pending.** On 2026-11-15 the preview still served the editor from before S2-07 (no "Your draft" controls), so it needs a redeploy from current `main`. |
| CI run | **Pending** (link the green run on the pull request) |
| Clean environment | Fresh clone, `npm ci`, Node 22.23.4, npm 10.9.9, Ubuntu 24.04 |
| Second environment | **Pending**: Windows, Node 22.x, Chromium and Firefox |
| Browsers | Chromium 153 (Playwright 1.63.0). Firefox: **Pending**, runs in CI and on Windows. |
| Viewports | Desktop 1280×720; narrow Pixel 7 (412×839) |

## Release gate

From a clean checkout:

```bash
npm ci
npm run verify
npm run test:e2e:install   # first time only
npm run test:e2e
```

| Check | Result |
| --- | --- |
| Repository hygiene (`verify:repository`) | Pass |
| Lint | Pass |
| Typecheck (app and rules) | Pass |
| App tests | Pass, 229 |
| Rules tests | Pass, 135 (1 opt-in timing test skipped) |
| Production build | Pass |
| Production audit (`npm audit --omit=dev`) | Pass, 0 vulnerabilities |
| Startup and health smoke (`/api/health`, `/`, `/editor`) | Pass |
| Browser tests, Chromium desktop | Pass, 31 of 31 |
| Browser tests, Chromium narrow | Pass, 31 of 31 |
| Browser tests, Firefox desktop | **Pending** (31 tests; expect 93 passed in total) |
| `git diff --check` | Pass |

## Demo matrix

Automated tests are release-gate checks and run against the local production
server. Manual rows are presentation checks.

| Demo step | Automated test | Result |
| --- | --- | --- |
| Open the hosted preview with no local setup | Manual, by a teammate | **Pending** (after redeploy) |
| Load First Flight, The Long Walk, Last Flock Standing | `e2e/objective-editor.spec.ts` "loads … and hands it to playtest" | Pass |
| Resize the board without corrupting setup | `e2e/board.spec.ts` | Pass |
| Add a fairy piece from the visual library | `e2e/piece-library.spec.ts` "finds Chancellor by its Empress alias…" | Pass |
| Add a standard piece from the library | Manual | **Pending** |
| Search by alias and inspect a movement diagram | `e2e/piece-library.spec.ts` "finds Chancellor by its Empress alias…" | Pass |
| Create a movement visually | `e2e/piece-library.spec.ts` "creates a custom leaper visually…" | Pass |
| Advanced vectors stay in sync | `e2e/piece-library.spec.ts` "keeps the vector editor in sync…" | Pass |
| Configure capture-royal, reach-target, eliminate-all | `e2e/objective-editor.spec.ts` "switches objectives…", "adds targets by keyboard and on the board…" | Pass |
| Readable validation error and recovery | `e2e/piece-library.spec.ts` (zero vector), `e2e/draft-portability.spec.ts` "keeps the last valid draft…" | Pass |
| Enter playtest without data conversion | `e2e/playtest.spec.ts` "a custom piece and objective made in the editor reach playtest unchanged" | Pass |
| Win every showcase; winner, events, lock, reset | `e2e/playtest.spec.ts` "wins … locks the board, keeps the events and resets" (three tests) | Pass |
| Return to editor, refresh, recover the draft | `e2e/draft-portability.spec.ts` "autosaves an edited draft and restores it after a refresh" | Pass |
| Export, reset, re-import, same variant | `e2e/draft-portability.spec.ts` "exports a draft, resets, re-imports it…" (saved draft equal, export bytes equal) | Pass |
| Undo an import | `e2e/draft-portability.spec.ts` "undoes an import…" | Pass |
| Failed import keeps the current draft | `e2e/draft-portability.spec.ts` "a failed import explains…", "a valid JSON file that is not a variant…" | Pass |
| Browser console stays clean | Every test using the `editor` fixture fails on a console or page error | Pass |
| Health output | `e2e/smoke.spec.ts`, `verify:production` | Pass |
| Server logs and network failures on the preview | Manual, Vercel dashboard | **Pending** |

## Accessibility and devices

| Check | Evidence | Result |
| --- | --- | --- |
| Pointer, full demo | `e2e/playtest.spec.ts`, `e2e/draft-portability.spec.ts` | Pass |
| Keyboard, win a game | `e2e/playtest.spec.ts` "wins The Long Walk with the keyboard only" | Pass |
| Keyboard, add targets and close dialogs | `e2e/objective-editor.spec.ts`, `e2e/piece-library.spec.ts` (Enter, Escape, focus return) | Pass |
| Skip link and focus order start | `e2e/accessibility.spec.ts` "skip link is the first tab stop…" | Pass |
| Visible focus | `e2e/accessibility.spec.ts` "keyboard focus is visible…" | Pass |
| Accessible names | `e2e/accessibility.spec.ts` "every button, link and field…" | Pass |
| Announcements | `e2e/accessibility.spec.ts` "moves are announced in a live region" | Pass |
| Non-colour cues | `e2e/accessibility.spec.ts` "win conditions are told apart by text…" | Pass |
| Reduced motion | `e2e/accessibility.spec.ts` "pieces move without animation…" | Pass |
| No sideways scroll, desktop and narrow | `e2e/accessibility.spec.ts` "the page does not scroll sideways" | Pass |
| Colour contrast | Manual, browser DevTools | **Pending** |
| Full keyboard-only run of the whole demo story | Manual | **Pending** |
| Second browser | Firefox project in `playwright.config.ts` | **Pending** |

## Screenshots and recording

Captured by `npm run evidence:capture` at `803b4ac`, saved in
`docs/evidence/sprint-2/`. This is optional evidence, not a release gate.

| View | Desktop | Narrow |
| --- | --- | --- |
| Editor | `s2-08-editor-desktop.png` | `s2-08-editor-narrow.png` |
| Piece library | `s2-08-library-desktop.png` | `s2-08-library-narrow.png` |
| Playtest (The Long Walk won) | `s2-08-playtest-desktop.png` | `s2-08-playtest-narrow.png` |

Backup recording: `s2-08-backup.webm` (desktop, all three showcases won, piece
library, objective editing, refresh recovery). Capture it again after S2-03
merges if anything on screen changes.

## Hygiene

- No secrets, keys, tokens, or `.env` files are tracked. `.env.example` holds
  only `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- `test-results/`, `playwright-report/`, and `blob-report/` are ignored and
  rejected by `verify:repository`.
- Sprint 2 needs no environment variables beyond platform defaults.

## Defects found

| Defect | Owner | Status |
| --- | --- | --- |
| Hosted preview serves an older build than `main` (no autosave, export, or import controls). | Deployment (Vercel project owner) | Open. Redeploy from current `main`, then record the commit above. |

No application defects were found by the browser tests at `803b4ac`.

## Known limits

Deferred past Sprint 2: accounts, publishing and gallery, online multiplayer,
advanced piece mechanics (promotion, drops, en passant, castling), and
combining several objectives in one variant. Drafts are saved only in the
current browser. Target markers are shown in playtest, not on the editor board.
