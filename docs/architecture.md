# Architecture

This document records the intended boundaries for Rookery. It is a direction, not a promise to build every service up front.

## Core principle

The rules engine is a pure state machine:

```text
variant definition + current position + proposed action
                         │
                         ▼
                    rules engine
                         │
                         ▼
              legal result or typed error
```

Given identical inputs and an engine version, every runtime must produce an identical result. Rendering, persistence, clocks, matchmaking, and network transport sit outside this boundary.

## Target components

| Component | Responsibility | Initial home |
| --- | --- | --- |
| Web app | Marketing, editor UI, gallery, game client, account flows | `src/app` |
| Rules package | Schema validation, legal actions, state transitions, win detection | Extract to `packages/rules` at first implementation |
| Application API | Variants, publishing, remixes, games, user data | Next.js route handlers initially |
| Multiplayer service | Rooms, clocks, reconnects, authoritative action processing | Add as `apps/realtime` when online play begins |
| Simulation workers | Balance checks, bots, and bulk game execution | Add only after the engine API stabilizes |

## Variant data

A variant should be a versioned, serializable definition rather than executable user code. Its eventual schema should cover:

- board topology and playable cells;
- piece types, initial placement, movement, capture, and abilities;
- turn order and action economy;
- objectives and terminal conditions;
- global modifiers; and
- presentation metadata and remix lineage.

Published definitions should be immutable. Editing a published variant creates a draft that can become a new version. Games reference an exact variant version and engine version so they remain replayable.

## Multiplayer model

The client sends an intent such as “move piece A to cell B.” The authoritative server loads the current state, validates the intent with the same rules package, persists the resulting event, then broadcasts the confirmed state. This prevents clients from deciding legality and gives game history a natural event log.

PostgreSQL is the source of truth. Redis should be introduced only when multiple real-time instances need shared room membership, pub/sub, or short-lived presence.

## Suggested delivery slices

1. **Local sandbox:** standard chess position, deterministic move generation, undo, and JSON import/export.
2. **Variant editor:** board and piece editing with schema validation and draft persistence.
3. **Publishing:** accounts, immutable versions, share pages, and remix lineage.
4. **Online games:** authoritative rooms, clocks, reconnects, and history.
5. **Community and simulation:** search, moderation, featured variants, bots, and balance tooling.

## Decisions intentionally deferred

- Authentication provider
- Hosting vendor and managed database provider
- WebSocket framework
- Rich editor state library
- Queue/worker platform
- Monetization and moderation policy

Those choices should follow a working local editor and measured product needs.
