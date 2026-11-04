# Sprint 1 demo checklist

This is the exact fallback-friendly demo path for the local Sprint 1 delivery.
It requires no database, account, external API, or hand-edited JSON.

## Clean setup

```bash
git clone https://github.com/fawzmehfil/rookery.git
cd rookery
node --version
npm --version
npm ci
npm run verify
```

Expected results:

- Node reports a `v22.x` release.
- Every lint, typecheck, application test, rules test, and production build passes.
- Production audit reports zero vulnerabilities.
- The production smoke reports `/api/health`, `/`, and `/editor` as passing.
- `git diff --check` produces no output.

Start the interactive development server:

```bash
npm run dev
```

Open <http://localhost:3000/editor>. In another terminal, verify:

```bash
curl --fail http://localhost:3000/api/health
```

Expected JSON:

```json
{"status":"ok","service":"rookery-web"}
```

## Editor and validation flow

1. Confirm the **First Flight** 5×5 board starts with six pieces and the draft
   check says the shared schema and semantic checks pass.
2. Change Files to `6`, apply the board size, select the **Tower** palette piece,
   choose **Place**, and place a white tower on `f1`.
3. Choose the Tower movement rule, change its direction frame to **Owner-relative**,
   and save. The draft should remain valid.
4. Choose **Remove** and remove the white sovereign from `c1`. Confirm the editor
   reports that White needs exactly one starting royal and disables **Open playtest**.
5. Choose the Sovereign palette piece, choose **Place**, and restore it on `c1`.
   Confirm validation recovers and **Open playtest** becomes available.
6. Open playtest. The 6×5 board and extra `f1` tower prove the exact edited draft
   crossed the parser/validator boundary without manual conversion.

## Engine and playtest flow

1. Select the white tower on `a1`. Confirm `a2`, `a3`, and `a4` are legal targets
   and `a5` is a capture target.
2. Activate `b2`. Confirm `ACTION_NOT_LEGAL` appears and the tower stays on `a1`.
3. Complete the canonical First Flight demonstration:

| Ply | Action | Expected result |
| --- | --- | --- |
| 1 | White tower `a1 → a4` | Black becomes active |
| 2 | Black hopper `a5 → b3` | White becomes active |
| 3 | White sovereign `c1 → b2` | Black becomes active |
| 4 | Black sovereign `c5 → b5` | White becomes active |
| 5 | White tower `a4 → b4` | Black becomes active |
| 6 | Black tower `e5 → e2` | White becomes active |
| 7 | White tower `b4 → b3` | Black hopper is captured |
| 8 | Black tower `e2 → e1` | White hopper is captured |
| 9 | White tower `b3 → b5` | Black sovereign is captured; White wins |

4. Confirm the terminal board is readable but rejects later input.
5. Choose **Reset position**. Confirm ply returns to `0`, White is active, every
   starting piece returns, captures/events clear, and the added `f1` tower remains.
6. Choose **Return to editor**. Confirm the 6×5 board, `f1` tower, and saved movement
   frame remain. Refresh the page and confirm the documented local-only boundary:
   unsaved changes reset to the bundled First Flight draft.

Repeat the canonical playtest with keyboard input: Tab to the board, use arrow
keys to move focus, Enter or Space to select/move, and Escape to clear selection.

## Shutdown and fallback

Stop the development server with `Ctrl+C`.

If Fast Refresh or the development server causes a demo problem, use the verified
standalone path instead:

```bash
npm run build
npm start
```

If the host environment has Node/npm trouble but Docker is available:

```bash
docker compose up --build
```

Stop it with `docker compose down`. If no live runtime is available, use the
[desktop victory state](evidence/sprint-1-desktop.png),
[narrow playtest](evidence/sprint-1-narrow.png), and
[backup recording](evidence/sprint-1-backup.mp4). They show the same tracked build
and canonical flow. The complete evidence matrix is in the
[Sprint 1 verification report](sprint-1-verification.md).
