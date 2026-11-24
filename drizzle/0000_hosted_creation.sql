CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"variant" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remix_parent_version_id" uuid,
	CONSTRAINT "drafts_positive_revision" CHECK ("drafts"."revision" > 0),
	CONSTRAINT "drafts_variant_object" CHECK (jsonb_typeof("drafts"."variant") = 'object')
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"source_draft_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publications_source_draft_unique" UNIQUE("source_draft_id")
);
--> statement-breakpoint
CREATE TABLE "published_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"source_revision" integer NOT NULL,
	"title" varchar(120) NOT NULL,
	"variant" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"engine_version" varchar(64) NOT NULL,
	"creator_display_name" varchar(120) NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remix_parent_version_id" uuid,
	CONSTRAINT "published_versions_number_unique" UNIQUE("publication_id","version_number"),
	CONSTRAINT "published_versions_source_revision_unique" UNIQUE("publication_id","source_revision"),
	CONSTRAINT "published_versions_positive_counters" CHECK ("published_versions"."version_number" > 0 AND "published_versions"."source_revision" > 0),
	CONSTRAINT "published_versions_schema_version_matches" CHECK ("published_versions"."schema_version" > 0 AND "published_versions"."variant" @> jsonb_build_object('schemaVersion', "published_versions"."schema_version")),
	CONSTRAINT "published_versions_remix_parent_not_self" CHECK ("published_versions"."remix_parent_version_id" <> "published_versions"."id")
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_remix_parent_version_id_published_versions_id_fk" FOREIGN KEY ("remix_parent_version_id") REFERENCES "public"."published_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_versions" ADD CONSTRAINT "published_versions_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_versions" ADD CONSTRAINT "published_versions_remix_parent_fk" FOREIGN KEY ("remix_parent_version_id") REFERENCES "public"."published_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drafts_owner_cursor_idx" ON "drafts" USING btree ("owner_id","id");--> statement-breakpoint
CREATE INDEX "drafts_remix_parent_idx" ON "drafts" USING btree ("remix_parent_version_id");--> statement-breakpoint
CREATE INDEX "publications_owner_idx" ON "publications" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "published_versions_remix_parent_idx" ON "published_versions" USING btree ("remix_parent_version_id");