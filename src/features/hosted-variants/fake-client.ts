import { z } from "zod";
import {
  createDraftSchema, ENGINE_COMPATIBILITY_VERSION, expectedRevisionSchema, listDraftsSchema,
  MAX_DRAFT_PAGE_SIZE, recordIdSchema, revisionSchema, updateDraftSchema, variantWriteIssues,
  versionReferenceSchema, type HostedDraft, type HostedFailure, type HostedResult,
  type HostedVariantClient, type Principal, type PublishedVersion, type VersionReference,
} from "./contracts";
import { exampleGuestCreator, exampleOwnedDraft, exampleOwner, exampleVersions, referenceOf } from "./fixtures";

const missing = () => fail("NOT_FOUND", "Record not found.");
const conflict = () => fail("REVISION_CONFLICT", "The draft has been updated. Reload it and try again.");
const unauthenticated = () => fail("UNAUTHENTICATED", "Sign in to continue.");

function fail(code: HostedFailure["error"]["code"], message: string): HostedFailure {
  return { ok: false, error: { code, message } };
}

function success<T>(data: T): HostedResult<T> {
  return { ok: true, data: structuredClone(data) };
}

function parsed<T>(schema: z.ZodType<T>, input: unknown): HostedResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const invalidVariant = result.error.issues.every(({ path }) => path[0] === "variant");
  return {
    ok: false,
    error: {
      code: invalidVariant ? "INVALID_VARIANT" : "INVALID_INPUT",
      message: invalidVariant ? "Fix the variant before continuing." : "Invalid request.",
      issues: result.error.issues.map(({ path, message }) => ({ path: path.map((p) => typeof p === "symbol" ? String(p) : p), message })),
    },
  };
}

function checkVariant(variant: HostedDraft["variant"]): HostedFailure | undefined {
  const issues = variantWriteIssues(variant);
  if (issues.length) return { ok: false, error: { code: "INVALID_VARIANT", message: "Fix the variant before continuing.", issues } };
}

/** In-memory test data. Each instance and each returned payload is independent. */
export function createHostedVariantFake() {
  let sequence = 0;
  const nextId = () => `50000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  const now = () => new Date(Date.UTC(2026, 10, 24, 0, 0, sequence++)).toISOString();
  const drafts = new Map([[exampleOwnedDraft.id, { owner: exampleOwner.userId, draft: structuredClone(exampleOwnedDraft) }]]);
  const versions = new Map(exampleVersions.map((version) => [version.id, structuredClone(version)]));
  const publishedRevisions = new Map<string, Map<number, PublishedVersion>>();

  function findVersion(ref: VersionReference) {
    const version = versions.get(ref.versionId);
    return version?.publication.id === ref.publicationId ? version : undefined;
  }

  function as(principal: Principal | null): HostedVariantClient {
    const owner = principal?.userId;
    const creator = { displayName: owner === exampleOwner.userId ? "Alice" : owner === exampleGuestCreator.userId ? "Bob" : "Creator" };

    function owned(id: string): HostedResult<HostedDraft> {
      if (!owner) return unauthenticated();
      const key = parsed(recordIdSchema, id);
      if (!key.ok) return key;
      const record = drafts.get(key.data);
      return record?.owner === owner ? { ok: true, data: record.draft } : missing();
    }

    function create(title: string, variant: HostedDraft["variant"], remixParent: VersionReference | null) {
      if (!owner) return unauthenticated();
      const invalid = checkVariant(variant);
      if (invalid) return invalid;
      const draft = { id: nextId(), title, variant, revision: 1, updatedAt: now(), publicationId: null, remixParent };
      drafts.set(draft.id, { owner, draft: structuredClone(draft) });
      return success(draft);
    }

    return {
      async listDrafts(input = {}) {
        if (!owner) return unauthenticated();
        const query = parsed(listDraftsSchema, input);
        if (!query.ok) return query;
        const page = [...drafts.values()]
          .filter(({ owner: draftOwner, draft }) => draftOwner === owner && draft.id > (query.data.after ?? ""))
          .map(({ draft: { id, title, revision, updatedAt } }) => ({ id, title, revision, updatedAt }))
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, MAX_DRAFT_PAGE_SIZE + 1);
        return success({ drafts: page.slice(0, MAX_DRAFT_PAGE_SIZE), nextCursor: page[MAX_DRAFT_PAGE_SIZE] ? page[MAX_DRAFT_PAGE_SIZE - 1].id : null });
      },
      async readDraft(id) {
        const result = owned(id);
        return result.ok ? success(result.data) : result;
      },
      async createDraft(input) {
        if (!owner) return unauthenticated();
        const result = parsed(createDraftSchema, input);
        return result.ok ? create(result.data.title, result.data.variant, null) : result;
      },
      async updateDraft(id, input) {
        if (!owner) return unauthenticated();
        const current = owned(id);
        if (!current.ok) return current;
        const update = parsed(updateDraftSchema, input);
        if (!update.ok) return update;
        if (current.data.revision !== update.data.expectedRevision) return conflict();
        const variant = update.data.variant ?? current.data.variant;
        const invalid = checkVariant(variant);
        if (invalid) return invalid;
        const revision = revisionSchema.safeParse(current.data.revision + 1);
        if (!revision.success) return fail("UNAVAILABLE", "Revision limit reached.");
        const draft = { ...current.data, variant, title: update.data.title ?? current.data.title, revision: revision.data, updatedAt: now() };
        drafts.set(id, { owner, draft: structuredClone(draft) });
        return success(draft);
      },
      async deleteDraft(id, input) {
        const current = owned(id);
        if (!current.ok) return current;
        const expected = parsed(expectedRevisionSchema, input);
        if (!expected.ok) return expected;
        if (current.data.revision !== expected.data.expectedRevision) return conflict();
        drafts.delete(id);
        publishedRevisions.delete(id);
        return success({ id });
      },
      async publishDraft(id, input) {
        const current = owned(id);
        if (!current.ok) return current;
        const expected = parsed(expectedRevisionSchema, input);
        if (!expected.ok) return expected;
        const history = publishedRevisions.get(id) ?? new Map<number, PublishedVersion>();
        const existing = history.get(expected.data.expectedRevision);
        if (existing) return success(existing);
        const draft = current.data;
        if (draft.revision !== expected.data.expectedRevision) return conflict();
        const invalid = checkVariant(draft.variant);
        if (invalid) return invalid;
        const source = draft.remixParent && findVersion(draft.remixParent);
        const version: PublishedVersion = {
          id: nextId(),
          publication: { id: draft.publicationId ?? nextId(), creator },
          versionNumber: history.size + 1,
          title: draft.title,
          variant: structuredClone(draft.variant),
          schemaVersion: draft.variant.schemaVersion,
          engineVersion: ENGINE_COMPATIBILITY_VERSION,
          publishedAt: now(),
          remixParent: source ? { ...referenceOf(source), creator: source.publication.creator } : null,
        };
        history.set(draft.revision, version);
        publishedRevisions.set(id, history);
        versions.set(version.id, version);
        draft.publicationId = version.publication.id;
        return success(version);
      },
      async readPublishedVersion(ref) {
        const result = parsed(versionReferenceSchema, ref);
        if (!result.ok) return result;
        const version = findVersion(result.data);
        return version ? success(version) : missing();
      },
      async remixVersion(ref) {
        if (!owner) return unauthenticated();
        const result = parsed(versionReferenceSchema, ref);
        if (!result.ok) return result;
        const source = findVersion(result.data);
        return source ? create(source.title, source.variant, referenceOf(source)) : missing();
      },
    };
  }

  return { as };
}
