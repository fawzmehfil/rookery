# Contributing to Rookery

Rookery is at an early stage. Small changes with an explicit product or technical reason are easier to review than broad speculative abstractions.

## Local workflow

1. Use Node.js 22 (`nvm use` if you use nvm).
2. Install dependencies with `npm install`.
3. Create a branch from `main`.
4. Run `npm run check` before opening a pull request.

## Engineering principles

- Keep rules deterministic and free of browser, database, and network dependencies.
- Treat the server as authoritative for multiplayer actions.
- Version published variant definitions; never silently change a game already in progress.
- Validate data at every trust boundary.
- Prefer accessible native HTML and keyboard-operable interactions.
- Add tests alongside executable game rules and bug fixes.

## Commits and pull requests

Use short, imperative commit subjects. A pull request should explain the user-facing outcome, important tradeoffs, and how the change was verified.
