# Hosted variant database foundation

PostgreSQL is optional for the existing guest editor and playtest. The Compose
database profile provides a local database for hosted feature development.

## Local setup and verification

Run these commands from the repository root with Node.js 22 and Docker Compose.

```sh
npm ci
docker compose up --wait postgres
export DATABASE_URL=postgres://rookery:rookery_local@127.0.0.1:54329/rookery
npm run db:migrate
npm run db:migrate
ROOKERY_DB_TEST_URL="$DATABASE_URL" npm run db:smoke
```

The first migration creates the schema. The second invocation checks that the
migration journal is already current. The smoke test uses isolated IDs and
rolls its transaction back. Point it only at a disposable database. CI runs
this sequence in its own job with a fresh Compose service.

Use `docker compose stop postgres` to stop the database and retain the named
volume. PostgreSQL is bound to loopback and the Compose credentials are local
examples. `docker compose up web` continues to work on its own.

Generate an additive migration after editing `src/server/db/schema.ts` with
`npm run db:generate -- --name=describe_change`. Review and commit its SQL,
journal and snapshot together. Apply migrations as a separate release step
with `DATABASE_URL` set for the intended environment. Give preview and test
deployments their own database and credentials. Keep database URLs server-only
and store hosted credentials in the deployment secret store. Builds, guest
routes and health checks require no database configuration.

The scoped esbuild override patches Drizzle Kit's legacy development loader.
Recheck whether it is needed when updating Drizzle Kit.

## Records and lifecycle

| Record | Ownership and retention |
| --- | --- |
| App user | Owns drafts and publications. The auth integration will map provider identities to this internal UUID. |
| Draft | Private mutable rules and a revision counter. Remixes can point to an exact published version. |
| Publication | Stable owner and unique source draft ID. The source ID is retained even after the draft is deleted. |
| Published version | Snapshot with rules JSONB, title, creator label, schema/engine versions, source revision and exact remix parent version. Retained after draft deletion. |

Foreign keys preserve ancestry and prevent accidental deletion of referenced
users, publications or versions. Account deletion and publication takedown
policies require explicit workflows before unrestricted registrations.
Provider-specific identity tables can be added by the auth integration.

## Repository handoff

- Import the lazy connection from `src/server/db/client.ts` in server code.
  Resolve the authenticated principal before calling the repository interfaces.
  Filter private reads and writes by owner and ID.
- Scope draft updates and deletes by owner, ID and the expected revision in the
  write. Advance the revision with the update. Distinguish an owned stale
  revision from a missing record without revealing another owner's draft.
- Publish in a transaction from the locked owned draft. Look up an existing
  version for the same source revision, otherwise allocate the next version
  number and insert the validated snapshot. Per-publication unique keys
  backstop both invariants. Expose no snapshot-update method.
- Build public metadata from the specific version row, joining its parent
  version for attribution. Match publication and version IDs together. Parse
  the projection before returning it, normalize timestamps to the API's ISO
  format, and keep owner and source revision fields private.

The HTTP shapes and error behavior are in the
[hosted variant contracts](hosted-variant-contracts.md).
