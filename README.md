<div align="center">

<img src="assets/rookery.png" alt="Rookery" width="120" />

<h1>Rookery</h1>

<p>
  Rookery is an engine for creating, sharing, and playing chess variants. The long-term product pairs a no-code variant editor with a deterministic rules engine, instant playtesting, community remixing, and real-time multiplayer on a fully hosted web platform.
</p>

</div>

---

## Stack

| Area | Choice | Why |
| --- | --- | --- |
| Web application | Next.js App Router + React + TypeScript | A strong browser experience, shareable server-rendered pages, and one language across the early product. |
| Styling | Plain CSS with design tokens initially | Keeps the foundation small; a component system can be added once editor interaction patterns settle. |
| Rules engine | Framework-free TypeScript package | Runs identically in the browser, server, tests, and future simulation workers. |
| Persistent data | PostgreSQL + Drizzle ORM | Fits relational data such as users, variants, versions, games, and remixes while retaining JSON support for rule definitions. |
| Multiplayer | Authoritative Node.js service + WebSockets | The server validates every action; clients only propose moves and render confirmed state. |
| Presence and scale | Redis, when needed | Useful later for rooms, presence, fan-out, and short-lived state—not required for the first playable prototype. |
| Validation/testing | Zod + Vitest + Testing Library | Shared schemas at trust boundaries, deterministic engine tests, and accessible component/integration coverage. |
| Deployment | Docker anywhere; Vercel for the web app | A portable baseline with a low-friction hosted path and custom-domain support. |

This repository contains one Next.js application and the framework-independent
`@rookery/rules` workspace. A multiplayer service will be split out only when
online play begins. See [the architecture notes](docs/architecture.md).

## Getting started

Requirements:

- Node.js 22
- npm 10+

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The environment copy is optional for the local Sprint 1 build; it records the
public origin used by future hosted environments.

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at [http://localhost:3000/api/health](http://localhost:3000/api/health).

The no-code variant editor is at [http://localhost:3000/editor](http://localhost:3000/editor).
Start with First Flight, resize the board, place pieces, and configure movement
rules. A valid draft opens directly in a deterministic local playtest. Drafts
stay in the current tab and are intentionally reset by a page refresh or process
restart. See the [Sprint 1 demo checklist](docs/sprint-1-demo.md),
[editor interactions](docs/variant-editor.md), [playtest integration](docs/local-playtest.md),
and [semantic validation](docs/variant-validation.md).

Useful commands:

```bash
npm run dev        # start the local development server
npm run lint       # run static analysis
npm run typecheck  # check TypeScript without emitting files
npm test           # run application and rules tests
npm run build      # create a production build
npm start          # run the production build
npm run verify     # run the complete local/CI delivery gate
```

`npm run verify` runs lint, both typechecks, all ordinary tests, the production
build, production dependency audit, standalone startup/health smoke, and diff
hygiene. Run it before requesting review.

## Run with Docker

```bash
docker compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000). Stop it with `docker compose down`.

## Deploy

The app builds as a standalone Node.js container. Any platform that can run the included `Dockerfile` can host it. It can also be imported directly into Vercel with the default Next.js settings. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin, such as `https://rookery.example`, before building.

No database or external service is required for this foundation. Future required variables belong in `.env.example`; secrets must never be committed. Production rollout, domains, data services, and observability are outlined in [docs/deployment.md](docs/deployment.md).

## Repository layout

```text
.
├── assets/                # Imported brand assets
├── docs/                  # Architecture, verification, demo, and deployment notes
├── packages/rules/        # Framework-independent schemas and deterministic engine
├── public/                # Static public assets
├── scripts/               # Standalone build and production verification helpers
├── src/app/               # Next.js routes and global presentation
├── src/components/        # Shared accessible board surface
├── src/features/          # Editor, playtest, workshop, and UI adapters
├── compose.yaml           # Local production-like runtime
├── Dockerfile             # Multi-stage production image
└── package.json           # Workspace scripts and dependencies
```

## Current delivery and next milestones

Sprint 1 delivers versioned variant data, structural parsing, semantic validation,
deterministic legal actions/transitions, an accessible no-code editor, and local
playtesting with First Flight. Known rule and persistence limits are recorded in
the [Sprint 1 verification report](docs/sprint-1-verification.md).

1. Add durable drafts, JSON import, accounts, variants, and immutable published versions.
2. Add remix lineage, share pages, moderation basics, and community discovery.
3. Introduce authoritative multiplayer, reconnects, clocks, and game history.
4. Expand the rules language with reviewed abilities, modifiers, and objectives.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.
