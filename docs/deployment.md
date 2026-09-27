# Deployment

Rookery is intended to be a public, custom-domain web platform. The repository supports both a standalone Docker deployment and a managed Next.js deployment.

## Foundation release

For the current stateless build:

1. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin in a managed host, or pass it to Docker as a build argument: `docker build --build-arg NEXT_PUBLIC_APP_URL=https://rookery.example .`.
2. Build the `Dockerfile`, or import the repository into a Next.js-compatible host.
3. Point the domain to the hosting provider and enforce HTTPS.
4. Configure uptime monitoring against `/api/health`.
5. Deploy from `main` only after the CI check succeeds.

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
