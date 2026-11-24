# Hosted variant contracts

Import the runtime schemas and asynchronous `HostedVariantClient` from
`src/features/hosted-variants/contracts.ts`. The HTTP routes below are
the implementation contract. The existing browser editor continues using its
local draft repository and JSON envelope.

## HTTP surface

Success uses `{ "ok": true, "data": ... }`. Failure uses
`{ "ok": false, "error": { "code": "...", "message": "...", "issues": [...] } }`.
Validate route IDs with `recordIdSchema`, public route pairs with
`versionReferenceSchema`, and inputs and responses with the named schemas.

| Operation | Request | Input | Success data and status |
| --- | --- | --- | --- |
| List private drafts | GET /api/drafts | `listDraftsSchema` query | `draftPageSchema`, 200 |
| Open a draft | GET /api/drafts/{id} | Path only | `hostedDraftSchema`, 200 |
| Create or copy a local draft | POST /api/drafts | `createDraftSchema` body | `hostedDraftSchema`, 201 |
| Save or rename | PATCH /api/drafts/{id} | `updateDraftSchema` body | `hostedDraftSchema`, 200 |
| Delete a draft | DELETE /api/drafts/{id} | `expectedRevisionSchema` JSON body | `deletedDraftSchema`, 200 |
| Publish a draft | POST /api/drafts/{id}/publish | `expectedRevisionSchema` body | `publishedVersionSchema`, 201 for a new version or 200 for a retry |
| View an exact public version | GET /api/variants/{publicationId}/versions/{versionId} | Path only | `publishedVersionSchema`, 200 |
| Remix an exact version | POST /api/variants/{publicationId}/versions/{versionId}/remix | Path only | `hostedDraftSchema`, 201 |

Saving a title can send `{ "expectedRevision": 1, "title": "My variant" }`.
Publishing can send `{ "expectedRevision": 2 }`. For a creation example with a
full rules payload, send `{ title: exampleOwnedDraft.title, variant: exampleOwnedDraft.variant }`
from the fixtures module. Draft listing sorts by UUID ascending within the owner,
returns up to 50 summaries, and uses the last returned ID as the exclusive
`after` cursor when another page exists. Use `Cache-Control: private, no-store`
for private responses.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | INVALID_INPUT | Malformed JSON, path, query, or request fields |
| 401 | UNAUTHENTICATED | An authenticated session is required |
| 404 | NOT_FOUND | Missing, inaccessible, or mismatched record |
| 409 | REVISION_CONFLICT | Expected revision is stale |
| 413 | PAYLOAD_TOO_LARGE | JSON body exceeds 1 MiB as read by the handler |
| 422 | INVALID_VARIANT | Variant fails structural or semantic validation |
| 503 | UNAVAILABLE | Persistence unavailable or a record limit is exhausted |

An authenticated caller sees the same 404 for a nonexistent draft and one owned
by another account. Require the trusted session before private operations. Derive
ownership from its provider-independent internal UUID (the `Principal`), and
reject unknown write fields. Report validation issues with paths rooted in the
request, such as `["variant", "setup", 0]`.

## Persistence and version behavior

- Accept the existing rules schema versions 1 and 2 as authored. Validate
  variant writes with the shared rules validator. Warnings do not block writes.
  Invalid edits can stay in the editor while the last valid save remains intact.
- Each draft starts at revision 1. Save and delete compare the expected revision
  atomically with the stored revision. Each accepted save advances it once.
- Publication locks the owned draft, revalidates the exact saved revision,
  and stores an independent snapshot. Use one publication per original draft
  and a unique version per publication and source revision. The first version
  is numbered 1. In the same transaction, allocate the next number and insert
  the version. A retry for a previously published revision returns that same
  snapshot, even after a newer edit. An unpublished stale revision conflicts.
- Snapshot metadata records the variant schema version, the engine compatibility
  identifier `rookery-rules-1`, title, creator label and exact remix source.
  This identifier records the behavior at publication time. The current
  sprint uses the current engine for supported document versions.
- Public projections include only the fields in `publishedVersionSchema`.
  The version page path is `/variants/{publicationId}/versions/{versionId}`, as
  shown by `examplePublicPath`. Both IDs must match. Creating a remix copies the
  original rules into a new private draft with the exact parent reference.
  Draft deletion preserves the original publication and all version links.

For UI development, create one `createHostedVariantFake()` and use
`fake.as(exampleOwner)`, `fake.as(exampleGuestCreator)`, or `fake.as(null)`.
The clients share fixture state within that fake instance. An anonymous caller
can view the published remix fixture, and its parent link resolves to the
original fixture. The fake models response shapes and cross-account behavior
without credentials, a database, or HTTP.
