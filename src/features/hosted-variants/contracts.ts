import { validateVariantDefinition, variantDefinitionSchema } from "@rookery/rules";
import { z } from "zod";

export const recordIdSchema = z.uuid();
export const revisionSchema = z.int32().positive();
export const variantTitleSchema = z.string().trim().min(1).max(120);
export const engineVersionSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
export const MAX_HOSTED_BODY_BYTES = 1_048_576;
export const MAX_DRAFT_PAGE_SIZE = 50;
export const ENGINE_COMPATIBILITY_VERSION = "rookery-rules-1";

export const principalSchema = z.strictObject({ userId: recordIdSchema });
export const creatorSchema = z.strictObject({ displayName: variantTitleSchema });
export const versionReferenceSchema = z.strictObject({
  publicationId: recordIdSchema,
  versionId: recordIdSchema,
});
export const draftSummarySchema = z.strictObject({
  id: recordIdSchema,
  title: variantTitleSchema,
  revision: revisionSchema,
  updatedAt: z.iso.datetime(),
});
export const hostedDraftSchema = draftSummarySchema.extend({
  variant: variantDefinitionSchema,
  publicationId: recordIdSchema.nullable(),
  remixParent: versionReferenceSchema.nullable(),
});
export const publicationSchema = z.strictObject({ id: recordIdSchema, creator: creatorSchema });
export const publishedVersionSchema = z.strictObject({
  id: recordIdSchema,
  publication: publicationSchema,
  versionNumber: revisionSchema,
  title: variantTitleSchema,
  variant: variantDefinitionSchema,
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  engineVersion: engineVersionSchema,
  publishedAt: z.iso.datetime(),
  remixParent: versionReferenceSchema.extend({ creator: creatorSchema }).nullable(),
}).refine((version) => version.schemaVersion === version.variant.schemaVersion, {
  path: ["schemaVersion"],
  message: "Schema version must match the stored variant.",
});

export const listDraftsSchema = z.strictObject({ after: recordIdSchema.optional() });
export const draftPageSchema = z.strictObject({
  drafts: z.array(draftSummarySchema).max(MAX_DRAFT_PAGE_SIZE),
  nextCursor: recordIdSchema.nullable(),
});
export const createDraftSchema = z.strictObject({
  title: variantTitleSchema,
  variant: variantDefinitionSchema,
});
export const expectedRevisionSchema = z.strictObject({ expectedRevision: revisionSchema });
export const updateDraftSchema = expectedRevisionSchema.extend({
  title: variantTitleSchema.optional(),
  variant: variantDefinitionSchema.optional(),
}).refine((value) => value.title !== undefined || value.variant !== undefined, {
  message: "Provide a title or variant to update.",
});
export const deletedDraftSchema = z.strictObject({ id: recordIdSchema });

const issueSchema = z.strictObject({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});
export const hostedErrorSchema = z.strictObject({
  code: z.enum([
    "INVALID_INPUT", "INVALID_VARIANT", "PAYLOAD_TOO_LARGE", "UNAUTHENTICATED",
    "NOT_FOUND", "REVISION_CONFLICT", "UNAVAILABLE",
  ]),
  message: z.string(),
  issues: z.array(issueSchema).optional(),
});

export function hostedResultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data }),
    z.strictObject({ ok: z.literal(false), error: hostedErrorSchema }),
  ]);
}

export const hostedResponses = {
  listDrafts: hostedResultSchema(draftPageSchema),
  draft: hostedResultSchema(hostedDraftSchema),
  deleteDraft: hostedResultSchema(deletedDraftSchema),
  publishedVersion: hostedResultSchema(publishedVersionSchema),
};

export type Principal = Readonly<z.infer<typeof principalSchema>>;
export type HostedDraft = z.infer<typeof hostedDraftSchema>;
export type DraftSummary = z.infer<typeof draftSummarySchema>;
export type DraftPage = z.infer<typeof draftPageSchema>;
export type Publication = z.infer<typeof publicationSchema>;
export type PublishedVersion = z.infer<typeof publishedVersionSchema>;
export type VersionReference = z.infer<typeof versionReferenceSchema>;
export type CreateDraft = z.input<typeof createDraftSchema>;
export type ListDrafts = z.input<typeof listDraftsSchema>;
export type UpdateDraft = z.input<typeof updateDraftSchema>;
export type ExpectedRevision = z.input<typeof expectedRevisionSchema>;
export type HostedError = z.infer<typeof hostedErrorSchema>;
export type HostedFailure = { ok: false; error: HostedError };
export type HostedResult<T> = { ok: true; data: T } | HostedFailure;

export interface HostedVariantClient {
  listDrafts(input?: ListDrafts): Promise<HostedResult<DraftPage>>;
  readDraft(id: string): Promise<HostedResult<HostedDraft>>;
  createDraft(input: CreateDraft): Promise<HostedResult<HostedDraft>>;
  updateDraft(id: string, input: UpdateDraft): Promise<HostedResult<HostedDraft>>;
  deleteDraft(id: string, input: ExpectedRevision): Promise<HostedResult<z.infer<typeof deletedDraftSchema>>>;
  publishDraft(id: string, input: ExpectedRevision): Promise<HostedResult<PublishedVersion>>;
  readPublishedVersion(ref: VersionReference): Promise<HostedResult<PublishedVersion>>;
  remixVersion(ref: VersionReference): Promise<HostedResult<HostedDraft>>;
}

export function publicVersionPath({ publicationId, versionId }: VersionReference): string {
  return `/variants/${encodeURIComponent(publicationId)}/versions/${encodeURIComponent(versionId)}`;
}

export function variantWriteIssues(variant: HostedDraft["variant"]) {
  return validateVariantDefinition(variant)
    .filter(({ severity }) => severity === "error")
    .map(({ path, message }) => ({ path: ["variant", ...path], message }));
}
