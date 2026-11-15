# Sprint 2 verification report

> Draft outline. Final results are recorded only against the integrated
> `main` commit after S2-02, S2-03, S2-06, and S2-07 are merged.

## Build under test

| Item | Value |
| --- | --- |
| Integrated base commit | _to add_ |
| Hosted preview URL | _to add_ |
| CI run | _to add_ |
| Node / npm | _to add_ |
| OS | _to add_ |
| Browsers | Chromium _version_, Firefox _version_ |
| Viewports | Desktop 1280×720, narrow (Pixel 7, 412×915) |

## Release gate

Clean checkout, then:

```bash
npm ci
npm run verify
npm run test:e2e
```

| Check | Result |
| --- | --- |
| Repository hygiene | _to add_ |
| Lint | _to add_ |
| Typecheck (app and rules) | _to add_ |
| Unit and integration tests | _to add_ |
| Production build | _to add_ |
| Production audit | _to add_ |
| Startup and health smoke | _to add_ |
| Browser tests (Chromium desktop and narrow, Firefox desktop) | _to add_ |
| `git diff --check` | _to add_ |

## Demo matrix

| Area | Automated test | Manual evidence | Result |
| --- | --- | --- | --- |
| Hosted preview opens with no setup | | Screenshot | _to add_ |
| Load all three showcases | `e2e/objective-editor.spec.ts` | | _to add_ |
| Resize or change playable cells | `e2e/board.spec.ts` | | _to add_ |
| Add standard and fairy piece from library | `e2e/piece-library.spec.ts` | | _to add_ |
| Search by alias, preview diagram | `e2e/piece-library.spec.ts` | | _to add_ |
| Create and edit a movement visually | `e2e/piece-library.spec.ts` | | _to add_ |
| Advanced vectors stay in sync | `e2e/piece-library.spec.ts` | | _to add_ |
| Capture-royal, reach-target, eliminate-all | `e2e/objective-editor.spec.ts` | | _to add_ |
| Readable validation error and recovery | `e2e/piece-library.spec.ts` | | _to add_ |
| Enter playtest without data conversion | `e2e/objective-editor.spec.ts` | | _to add_ |
| Win every showcase; winner, events, lock, reset | waits on S2-02, S2-06 | | _to add_ |
| Refresh recovers the saved draft | waits on S2-07 | | _to add_ |
| Export, re-import, same variant | waits on S2-07 | | _to add_ |
| Failed import keeps the current draft | waits on S2-07 | | _to add_ |
| Console, network, and health clean | test fixture fails on console errors | | _to add_ |

## Accessibility and devices

| Check | Result |
| --- | --- |
| Full demo with pointer | _to add_ |
| Full demo with keyboard only | _to add_ |
| Focus order and visible focus | _to add_ |
| Accessible names and announcements | _to add_ |
| Contrast and non-color cues | _to add_ |
| Reduced motion | _to add_ |
| Second browser | _to add_ |

## Screenshots and recording

Saved under `docs/evidence/sprint-2/`: desktop and narrow shots of the
library, editor, and playtest, plus a short backup recording. _to add_

## Defects found

| Defect | Owner task | Fix and regression test | Status |
| --- | --- | --- | --- |
| | | | |

## Known limits

Accounts, publishing and gallery, online multiplayer, advanced piece
mechanics, and objective combinations are deferred past Sprint 2.
