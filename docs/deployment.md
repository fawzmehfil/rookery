# Deployment

Rookery is intended to be a public, custom-domain web platform. The repository supports both a standalone Docker deployment and a managed Next.js deployment.

## Foundation release

For the current stateless build:

1. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin in a managed host, or pass it to Docker as a build argument: `docker build --build-arg NEXT_PUBLIC_APP_URL=https://rookery.example .`.
2. Build the `Dockerfile`, or import the repository into a Next.js-compatible host.
3. Point the domain to the hosting provider and enforce HTTPS.
4. Configure uptime monitoring against `/api/health`.
5. Deploy from `main` only after the CI `npm run verify` gate succeeds.

The same command is the local release gate. It builds the standalone server,
starts it on an isolated port, verifies `/api/health`, `/`, and `/editor`, then
stops it. The workflow uses the repository's `.nvmrc` Node 22 release and a clean
`npm ci`, so it does not rely on local generated files.

## Before user data ships

Add these capabilities before opening account creation or public publishing:

- managed PostgreSQL with automated backups and point-in-time recovery;
- database migrations run as a distinct release step;
- authentication, session protection, rate limits, and abuse controls;
- error tracking, structured logs, performance monitoring, and audit events;
- separate preview and production environments with isolated credentials;
- object storage and malware/content checks for future user uploads;
- a privacy policy, terms, moderation workflow, and data deletion path.

## Before multiplayer ships

Run authoritative game sessions in a long-lived WebSocket-capable service rather than relying on stateless request handlers. Persist confirmed game events, define reconnect and clock behavior, and load-test fan-out before enabling public rooms. Redis can coordinate rooms across instances; PostgreSQL remains the durable source of truth.

## Environment convention

Every required variable must be documented in `.env.example`. Browser-exposed values use the `NEXT_PUBLIC_` prefix; credentials never do. Production secrets belong in the hosting platform's secret store, not in the repository or container image.

## Sprint 2 hosted preview (Vercel)

The Sprint 2 demo runs on a Vercel preview built from the repository with the
default Next.js settings. No `vercel.json` is needed.

1. In Vercel, import `fawzmehfil/rookery` (a repository owner may need to
   approve the Vercel GitHub app).
2. Keep the detected framework (Next.js), install command (`npm ci` or the
   default), and build command (`npm run build`).
3. Node.js 22 is picked up from `engines.node` in `package.json`. Confirm the
   project setting shows 22.x.
4. Environment variables: none are required for Sprint 2. `NEXT_PUBLIC_APP_URL`
   only affects metadata links; set it to the preview origin if you want those
   links to point at the preview.
5. Every pull request gets a preview URL. The stable demo link is the preview
   for the integrated `main` commit; record that URL and commit in
   `docs/sprint-2-verification.md`.
6. Check the preview: `/api/health` returns `{"status":"ok","service":"rookery-web"}`,
   `/` and `/editor` load directly, and the editor responds to clicks.

Do not register a domain or turn on production traffic for Sprint 2.

If the preview is down, use the local fallback in `docs/sprint-2-demo.md`.

## Browser tests

Browser tests use Playwright and always run against the local production
server, never against a hosted preview:

```bash
npm run build
npm run test:e2e:install   # first time only, downloads Chromium and Firefox
npm run test:e2e
```

Tests run in desktop Chromium, a narrow phone-sized Chromium, and desktop
Firefox. The tests start `npm start` on port 3200 (override with `ROOKERY_E2E_PORT`).
Failures keep a screenshot, trace, and video in `test-results/`; CI uploads
that folder and `playwright-report/` when the browser job fails. Both folders
are ignored by Git.
