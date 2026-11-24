import type {
  CreateDraft, DraftPage, ExpectedRevision, HostedDraft, HostedResult, ListDrafts,
  Principal, PublishedVersion, UpdateDraft, VersionReference,
} from "@/features/hosted-variants/contracts";

/** Derive the principal from the server session before calling an owned operation. */
export interface DraftRepository {
  list(principal: Principal, query: ListDrafts): Promise<HostedResult<DraftPage>>;
  read(principal: Principal, id: string): Promise<HostedResult<HostedDraft>>;
  create(principal: Principal, input: CreateDraft): Promise<HostedResult<HostedDraft>>;
  /** Compare the expected revision and advance it in the same write. */
  update(principal: Principal, id: string, input: UpdateDraft): Promise<HostedResult<HostedDraft>>;
  delete(principal: Principal, id: string, input: ExpectedRevision): Promise<HostedResult<{ id: string }>>;
}

export interface VersionRepository {
  /** Scope the lock to the owner. Allocate and insert the snapshot in one transaction. */
  publish(
    principal: Principal, draftId: string, input: ExpectedRevision,
  ): Promise<HostedResult<{ version: PublishedVersion; created: boolean }>>;
  /** Return only the public projection, matching both IDs. */
  readPublic(ref: VersionReference): Promise<HostedResult<PublishedVersion>>;
  remix(principal: Principal, ref: VersionReference): Promise<HostedResult<HostedDraft>>;
}
