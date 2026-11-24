import { firstFlightVariant, longWalkVariant } from "@rookery/rules/fixtures";
import {
  ENGINE_COMPATIBILITY_VERSION, hostedDraftSchema, publicVersionPath, publishedVersionSchema,
  type PublishedVersion,
} from "./contracts";

export const exampleOwner = { userId: "10000000-0000-4000-8000-000000000001" };
export const exampleGuestCreator = { userId: "10000000-0000-4000-8000-000000000002" };
const timestamp = "2026-11-24T00:00:00.000Z";

const original = publishedVersionSchema.parse({
  id: "20000000-0000-4000-8000-000000000001",
  publication: { id: "30000000-0000-4000-8000-000000000001", creator: { displayName: "Alice" } },
  versionNumber: 1,
  title: firstFlightVariant.name,
  variant: firstFlightVariant,
  schemaVersion: firstFlightVariant.schemaVersion,
  engineVersion: ENGINE_COMPATIBILITY_VERSION,
  publishedAt: timestamp,
  remixParent: null,
});

export function referenceOf(version: PublishedVersion) {
  return { publicationId: version.publication.id, versionId: version.id };
}

export const examplePublishedRemix = publishedVersionSchema.parse({
  ...original,
  id: "20000000-0000-4000-8000-000000000002",
  publication: { id: "30000000-0000-4000-8000-000000000002", creator: { displayName: "Bob" } },
  title: "First Flight Remix",
  remixParent: { ...referenceOf(original), creator: original.publication.creator },
});
export const examplePublicPath = publicVersionPath(referenceOf(examplePublishedRemix));
export const exampleVersions = [original, examplePublishedRemix];

export const exampleOwnedDraft = hostedDraftSchema.parse({
  id: "40000000-0000-4000-8000-000000000001",
  title: longWalkVariant.name,
  revision: 1,
  updatedAt: timestamp,
  variant: longWalkVariant,
  publicationId: null,
  remixParent: null,
});
