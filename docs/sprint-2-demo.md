# Sprint 2 demo runbook

> Draft outline. Steps marked **(waits on S2-0x)** are filled in once that task
> is merged to `main`.

## Before the demo

- Hosted preview: <https://rookery-omega.vercel.app/editor> (commit _sha to add_ from the Vercel dashboard).
- Open `/api/health` on the preview and confirm `status: ok`.
- Use a fresh browser profile or private window so no old draft is loaded.

## Local fallback

If the preview is unavailable, on any machine with Node 22:

```bash
git clone https://github.com/fawzmehfil/rookery.git
cd rookery
npm ci
npm run build
npm start
```

Then open <http://localhost:3000/editor>.

## Demo story

1. **Showcases.** Load First Flight, The Long Walk, and Last Flock Standing.
   Point out the board size and objective for each.
2. **Board.** Resize the board or turn a cell off, and show the setup stays intact.
3. **Piece library.** Open "+ Add piece type", search `Empress` to find the
   Chancellor, preview its movement diagram, and add it.
4. **Movement creator.** Create a blank piece, draw a movement on the mini
   board, open "Advanced: edit movement vectors", and show the two stay in sync.
5. **Objectives.** Switch between capture the royal, reach a target, and
   eliminate all opponents. Add targets by typing and by clicking the board.
6. **Validation error.** Trigger one readable error (for example a zero
   vector) and fix it.
7. **Playtest.** Open playtest straight from the editor.
8. **Winning.** Play each showcase to its objective. Show the winner, the
   event log, the locked board, and reset. **(waits on S2-02, S2-06)**
9. **Autosave and recovery.** Return to the editor, refresh, and show the
   draft comes back. **(waits on S2-07)**
10. **Export and import.** Export, change the draft, import the file, and show
    it matches. Show a bad file leaves the current draft alone. **(waits on S2-07)**

## Reset between runs

- Clear site data for the preview (or close the private window).
- Reload `/editor`; First Flight should be the starting draft.

## Known limits (deferred)

Accounts, publishing and gallery, online multiplayer, advanced piece
mechanics, and combining several objectives are not part of Sprint 2.
