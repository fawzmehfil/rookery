# Sprint 2 demo runbook

A repeatable walk through the Sprint 2 flow: pick a showcase, change pieces
and objectives without code, play it to a win, and keep the draft.

## Before the demo

- Hosted demo: <https://rookery-omega.vercel.app/editor>. Nothing to install.
- Open <https://rookery-omega.vercel.app/api/health> and confirm
  `{"status":"ok","service":"rookery-web"}`.
- Use a private window so no old draft is loaded.
- Confirm the editor shows a **Your draft** section with Export JSON, Import
  JSON, and Reset draft. If it does not, the deployment is on an old build: use
  the local fallback.

## Local fallback

On any machine with Node 22:

```bash
git clone https://github.com/fawzmehfil/rookery.git
cd rookery
npm ci
npm run build
npm start
```

Then open <http://localhost:3000/editor>. The backup recording is
`docs/evidence/sprint-2/s2-08-backup.webm`.

## Demo story

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Click **Load The Long Walk**. | 3 × 3 board, two Runners, objective "Reach a target". |
| 2 | Click **+ Add piece type**, search `Empress`. | One result: Chancellor. |
| 3 | Click **Preview Chancellor**, then **Add Chancellor**. | Movement diagram shows; Chancellor appears in "Palette piece". |
| 4 | Click **+ Add piece type**, **Create a blank piece**. Name it `Unicorn`, token `U`, click `f7` on the mini board. | A leap is drawn. |
| 5 | Open **Advanced: edit movement vectors**. Set both numbers to `0`, then back to `1` and `2`. | A "cannot be zero" error appears, then clears. |
| 6 | Click **Add type and place copies**, then click `b1` on the board. | A White Unicorn stands on b1. |
| 7 | Under "How do you win?", click **Eliminate all opponents**, confirm, then **Reach a target** and add a White target `a3` and a Black target `c1`. | Target lists update; "Open playtest" is enabled again. |
| 8 | Click **Load The Long Walk**, confirm, then **Open playtest**. | Playtest opens with a Targets panel. |
| 9 | Play a1→a2, c3→c2, a2→a3. | "White wins", "reached a3", board locked, six events listed. |
| 10 | Click **Reset position**, then **Return to editor**. | Start position; editor draft unchanged. |
| 11 | Refresh the page. | The Long Walk comes back from autosave. |
| 12 | Click **Export JSON**. | `the-long-walk.rookery.json` downloads. |
| 13 | Click **Reset draft**, confirm. | First Flight is back. |
| 14 | Click **Import JSON**, choose the file, confirm. | The Long Walk is back; "Undo import" is offered. |
| 15 | Import any non-JSON file. | "Import failed", and the draft is unchanged. |

## The other two wins

- **First Flight** (capture the royal): a1→a4, a5→b3, c1→b2, c5→b5, a4→b4,
  e5→e2, b4→b3, e2→e1, b3→b5. White wins by capturing the Black Sovereign.
- **Last Flock Standing** (eliminate all): a1→a5, b5→b4, a5→c5, b4→a4, c5→e5,
  a4→a3, e1→a3. White wins by capturing Black's last piece.

## Reset between runs

- Click **Reset draft** and confirm, or close the private window.
- Reload `/editor`. First Flight should be the starting draft.

## If something goes wrong

| Problem | Do this |
| --- | --- |
| Hosted demo does not load | Use the local fallback, or play the backup recording. |
| "Your saved draft could not be restored" | Click **Reset saved draft**. |
| Playtest button is disabled | Read the "Your draft" status; fix the listed issue (often a missing target). |
| Wrong draft on screen | **Reset draft**, then load the showcase again. |

## Known limits (deferred)

Accounts, publishing and gallery, online multiplayer, advanced piece
mechanics, and combining several objectives are not part of Sprint 2. Drafts
live only in the current browser.
