import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { exampleOwnedDraft, examplePublishedRemix } from "../../src/features/hosted-variants/fixtures";
import { appUsers, drafts, publications, publishedVersions } from "../../src/server/db/schema";

const url = process.env.ROOKERY_DB_TEST_URL;
if (!url) throw new Error("Set ROOKERY_DB_TEST_URL to a migrated disposable PostgreSQL database.");

const connection = postgres(url, { max: 1 });
const database = drizzle(connection);
afterAll(() => connection.end());

it("round-trips variants, enforces version integrity and keeps remix ancestry after draft deletion", async () => {
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const sourceDraftId = randomUUID();
  const remixDraftId = randomUUID();
  const publicationId = randomUUID();
  const remixPublicationId = randomUUID();
  const versionId = randomUUID();
  const remixVersionId = randomUUID();
  const rollback = new Error("Rollback the smoke fixtures");

  await database.transaction(async (tx) => {
    await tx.insert(appUsers).values([
      { id: ownerId, displayName: "Alice" },
      { id: otherId, displayName: "Bob" },
    ]);
    const { variant, title } = exampleOwnedDraft;
    const [draft] = await tx.insert(drafts).values({ id: sourceDraftId, ownerId, variant, title }).returning();
    expect(draft).toMatchObject({ revision: 1, variant });
    await tx.insert(publications).values([
      { id: publicationId, ownerId, sourceDraftId },
      { id: remixPublicationId, ownerId: otherId, sourceDraftId: remixDraftId },
    ]);
    const snapshot = {
      title, variant, schemaVersion: variant.schemaVersion,
      engineVersion: examplePublishedRemix.engineVersion, creatorDisplayName: "Alice",
      publicationId, versionNumber: 1, sourceRevision: 1,
    };
    await tx.insert(publishedVersions).values({ ...snapshot, id: versionId });

    await expect(tx.transaction(async (nested) => {
      await nested.insert(publishedVersions).values({ ...snapshot, sourceRevision: 2 });
    })).rejects.toMatchObject({ cause: { code: "23505", constraint_name: "published_versions_number_unique" } });

    await expect(tx.transaction(async (nested) => {
      await nested.insert(publishedVersions).values({ ...snapshot, versionNumber: 2 });
    })).rejects.toMatchObject({ cause: { code: "23505", constraint_name: "published_versions_source_revision_unique" } });

    await expect(tx.transaction(async (nested) => {
      await nested.insert(drafts).values({ ownerId: otherId, title, variant, remixParentVersionId: randomUUID() });
    })).rejects.toMatchObject({ cause: { code: "23503" } });

    await tx.insert(drafts).values({ id: remixDraftId, ownerId: otherId, title, variant, remixParentVersionId: versionId });
    await tx.insert(publishedVersions).values({
      ...snapshot, id: remixVersionId, publicationId: remixPublicationId,
      creatorDisplayName: "Bob", remixParentVersionId: versionId,
    });
    await tx.delete(drafts).where(eq(drafts.id, sourceDraftId));
    expect(await tx.select().from(publications).where(eq(publications.id, publicationId))).toMatchObject([{ sourceDraftId }]);
    expect(await tx.select().from(publishedVersions).where(eq(publishedVersions.id, versionId))).toMatchObject([{ variant }]);
    expect(await tx.select().from(drafts).where(eq(drafts.id, remixDraftId))).toMatchObject([{ remixParentVersionId: versionId }]);
    expect(await tx.select().from(publishedVersions).where(eq(publishedVersions.id, remixVersionId))).toMatchObject([{ remixParentVersionId: versionId }]);
    throw rollback;
  }).catch((error: unknown) => {
    if (error !== rollback) throw error;
  });
});
