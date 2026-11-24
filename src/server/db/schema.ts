import type { VariantDefinition } from "@rookery/rules";
import { sql } from "drizzle-orm";
import {
  check, foreignKey, index, integer, jsonb, pgTable, timestamp, unique, uuid, varchar,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const title = () => varchar("title", { length: 120 }).notNull();
const variant = () => jsonb("variant").$type<VariantDefinition>().notNull();

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  createdAt: createdAt(),
});

export const publications = pgTable("publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => appUsers.id),
  // Provenance survives draft deletion. It uniquely identifies the publication
  // for this draft without requiring the draft row to remain.
  sourceDraftId: uuid("source_draft_id").notNull().unique("publications_source_draft_unique"),
  createdAt: createdAt(),
}, (t) => [index("publications_owner_idx").on(t.ownerId)]);

export const publishedVersions = pgTable("published_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicationId: uuid("publication_id").notNull().references(() => publications.id),
  versionNumber: integer("version_number").notNull(),
  sourceRevision: integer("source_revision").notNull(),
  title: title(),
  variant: variant(),
  schemaVersion: integer("schema_version").notNull(),
  engineVersion: varchar("engine_version", { length: 64 }).notNull(),
  creatorDisplayName: varchar("creator_display_name", { length: 120 }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  remixParentVersionId: uuid("remix_parent_version_id"),
}, (t) => [
  unique("published_versions_number_unique").on(t.publicationId, t.versionNumber),
  unique("published_versions_source_revision_unique").on(t.publicationId, t.sourceRevision),
  index("published_versions_remix_parent_idx").on(t.remixParentVersionId),
  foreignKey({
    name: "published_versions_remix_parent_fk",
    columns: [t.remixParentVersionId],
    foreignColumns: [t.id],
  }),
  check("published_versions_positive_counters", sql`${t.versionNumber} > 0 AND ${t.sourceRevision} > 0`),
  check("published_versions_schema_version_matches", sql`${t.schemaVersion} > 0 AND ${t.variant} @> jsonb_build_object('schemaVersion', ${t.schemaVersion})`),
  check("published_versions_remix_parent_not_self", sql`${t.remixParentVersionId} <> ${t.id}`),
]);

export const drafts = pgTable("drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => appUsers.id),
  title: title(),
  variant: variant(),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  remixParentVersionId: uuid("remix_parent_version_id").references(() => publishedVersions.id),
}, (t) => [
  index("drafts_owner_cursor_idx").on(t.ownerId, t.id),
  index("drafts_remix_parent_idx").on(t.remixParentVersionId),
  check("drafts_positive_revision", sql`${t.revision} > 0`),
  check("drafts_variant_object", sql`jsonb_typeof(${t.variant}) = 'object'`),
]);
