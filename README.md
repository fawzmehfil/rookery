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
| Validation/testing | Zod + Vitest; Playwright for key flows | Shared schemas at trust boundaries and fast deterministic engine tests. |
| Deployment | Docker anywhere; Vercel for the web app | A portable baseline with a low-friction hosted path and custom-domain support. |

This repository starts as one Next.js application. Extract the rules engine into `packages/rules` when the first executable rule exists, and split out a multiplayer service only when online play begins. That avoids premature infrastructure without painting the core into a UI-specific corner. See [the architecture notes](docs/architecture.md).

## Getting started

Requirements:

- Node.js 22
- npm 10+

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at [http://localhost:3000/api/health](http://localhost:3000/api/health).

Useful commands:

```bash
npm run dev        # start the local development server
npm run lint       # run static analysis
npm run typecheck  # check TypeScript without emitting files
npm run build      # create a production build
npm start          # run the production build
```

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
├── docs/                  # Architecture and deployment notes
├── public/                # Static assets
├── src/
│   └── app/               # Next.js routes, layout, and styles
├── compose.yaml           # Local production-like runtime
├── Dockerfile             # Multi-stage production image
└── package.json           # Scripts and dependencies
```

## Near-term milestones

1. Define the versioned variant schema and build a deterministic 8×8 move engine.
2. Add the board editor with draft autosave and immediate playtesting.
3. Persist accounts, variants, and immutable published versions in PostgreSQL.
4. Add remix lineage, share pages, and community discovery.
5. Introduce authoritative multiplayer, reconnects, clocks, and game history.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.
