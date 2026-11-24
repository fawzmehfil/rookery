import { describe, expect, it } from "vitest";
import { createDraftSchema, hostedResponses, publicVersionPath, publishedVersionSchema } from "./contracts";
import { createHostedVariantFake } from "./fake-client";
import { exampleGuestCreator, exampleOwnedDraft, exampleOwner, examplePublishedRemix, examplePublicPath, referenceOf } from "./fixtures";

function value<T>(result: { ok: true; data: T } | { ok: false }): T {
  if (!result.ok) throw new Error("Expected a successful response");
  return result.data;
}

describe("hosted variant contracts", () => {
  it("supports both existing rules schemas and keeps public metadata separate", () => {
    expect(exampleOwnedDraft.variant.schemaVersion).toBe(2);
    expect(examplePublishedRemix.variant.schemaVersion).toBe(1);
    expect(hostedResponses.publishedVersion.safeParse({ ok: true, data: examplePublishedRemix }).success).toBe(true);
    expect(examplePublicPath).toBe(publicVersionPath(referenceOf(examplePublishedRemix)));
    expect(publishedVersionSchema.safeParse({ ...examplePublishedRemix, ownerId: exampleOwner.userId }).success).toBe(false);
    expect(publishedVersionSchema.safeParse({ ...examplePublishedRemix, schemaVersion: 2 }).success).toBe(false);
    expect(createDraftSchema.safeParse({ title: "Draft", variant: exampleOwnedDraft.variant, ownerId: exampleOwner.userId }).success).toBe(false);
  });

  it("distinguishes guest access from missing or inaccessible records", async () => {
    const fake = createHostedVariantFake();
    const guest = fake.as(null);
    const other = fake.as(exampleGuestCreator);
    expect(value(await guest.readPublishedVersion(referenceOf(examplePublishedRemix)))).toEqual(examplePublishedRemix);
    expect(await guest.listDrafts()).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(await guest.remixVersion(referenceOf(examplePublishedRemix))).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(await other.readDraft(exampleOwnedDraft.id)).toEqual(await other.readDraft(exampleGuestCreator.userId));
    expect(await other.readDraft(exampleOwnedDraft.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("rejects malformed and semantically invalid edits with issue paths", async () => {
    const client = createHostedVariantFake().as(exampleOwner);
    expect(await client.updateDraft(exampleOwnedDraft.id, { expectedRevision: 0, title: "Update" })).toMatchObject({
      ok: false, error: { code: "INVALID_INPUT", issues: [{ path: ["expectedRevision"] }] },
    });
    const variant = { ...exampleOwnedDraft.variant, setup: [...exampleOwnedDraft.variant.setup, exampleOwnedDraft.variant.setup[0]] };
    expect(await client.updateDraft(exampleOwnedDraft.id, { expectedRevision: 1, variant })).toMatchObject({
      ok: false, error: { code: "INVALID_VARIANT", issues: expect.arrayContaining([expect.objectContaining({ path: expect.arrayContaining(["variant"]) })]) },
    });
    expect(value(await client.readDraft(exampleOwnedDraft.id))).toEqual(exampleOwnedDraft);
  });

  it("protects revisions, deduplicates publish retries and preserves exact remix ancestry", async () => {
    const fake = createHostedVariantFake();
    const client = fake.as(exampleOwner);
    const bob = fake.as(exampleGuestCreator);
    const { id } = exampleOwnedDraft;
    expect(value(await client.listDrafts())).toMatchObject({ nextCursor: null, drafts: [{ id }] });
    const first = value(await client.publishDraft(id, { expectedRevision: 1 }));
    const sourceRef = referenceOf(first);
    const remix = value(await bob.remixVersion(sourceRef));
    expect(remix.remixParent).toEqual(sourceRef);
    expect(value(await client.updateDraft(id, { expectedRevision: 1, title: "Second title" })).revision).toBe(2);
    expect(await client.deleteDraft(id, { expectedRevision: 1 })).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(value(await client.publishDraft(id, { expectedRevision: 1 }))).toEqual(first);
    expect(value(await client.publishDraft(id, { expectedRevision: 2 }))).toMatchObject({ publication: first.publication, versionNumber: 2 });
    expect(value(await bob.publishDraft(remix.id, { expectedRevision: 1 })).remixParent).toEqual({ ...sourceRef, creator: first.publication.creator });
    expect(value(await client.deleteDraft(id, { expectedRevision: 2 }))).toEqual({ id });
    expect(value(await fake.as(null).readPublishedVersion(sourceRef))).toEqual(first);
  });
});
