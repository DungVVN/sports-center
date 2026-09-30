-- Additive CMS foundation for the public website only. Existing operational
-- tables, permissions, and published hard-coded pages are unchanged.
CREATE TABLE "site_pages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "route_key" VARCHAR(80) NOT NULL UNIQUE,
  "path" VARCHAR(240) NOT NULL UNIQUE,
  "kind" VARCHAR(16) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "site_pages_route_key_check" CHECK ("route_key" ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT "site_pages_path_check" CHECK ("path" = '/' OR "path" ~ '^/[a-z0-9][a-z0-9/-]*$'),
  CONSTRAINT "site_pages_kind_check" CHECK ("kind" IN ('home', 'static'))
);

CREATE TABLE "site_page_revisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "page_id" UUID NOT NULL REFERENCES "site_pages"("id") ON DELETE RESTRICT,
  "version_number" INTEGER NOT NULL CHECK ("version_number" > 0),
  "edit_revision" INTEGER NOT NULL DEFAULT 1 CHECK ("edit_revision" > 0),
  "status" VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published')),
  "title" VARCHAR(240) NOT NULL,
  "seo_title" VARCHAR(240) NOT NULL DEFAULT '',
  "seo_description" VARCHAR(500) NOT NULL DEFAULT '',
  "blocks" JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("blocks") = 'array'),
  "created_by" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "updated_by" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "site_page_revisions_page_id_version_number_key" UNIQUE ("page_id", "version_number"),
  CONSTRAINT "site_page_revisions_page_id_id_key" UNIQUE ("page_id", "id")
);

CREATE UNIQUE INDEX "site_page_revisions_one_draft_idx"
  ON "site_page_revisions"("page_id") WHERE "status" = 'draft';
CREATE INDEX "site_page_revisions_page_id_status_idx"
  ON "site_page_revisions"("page_id", "status");

CREATE TABLE "site_page_publications" (
  "page_id" UUID PRIMARY KEY REFERENCES "site_pages"("id") ON DELETE RESTRICT,
  "revision_id" UUID NOT NULL UNIQUE,
  "published_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "site_page_publications_revision_owner_fkey"
    FOREIGN KEY ("page_id", "revision_id")
    REFERENCES "site_page_revisions"("page_id", "id") ON DELETE RESTRICT
);

CREATE TABLE "site_menu_revisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "location" VARCHAR(16) NOT NULL CHECK ("location" IN ('header', 'footer')),
  "version_number" INTEGER NOT NULL CHECK ("version_number" > 0),
  "edit_revision" INTEGER NOT NULL DEFAULT 1 CHECK ("edit_revision" > 0),
  "status" VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published')),
  "items" JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("items") = 'array'),
  "created_by" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "updated_by" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "site_menu_revisions_location_version_number_key" UNIQUE ("location", "version_number"),
  CONSTRAINT "site_menu_revisions_location_id_key" UNIQUE ("location", "id")
);

CREATE UNIQUE INDEX "site_menu_revisions_one_draft_idx"
  ON "site_menu_revisions"("location") WHERE "status" = 'draft';
CREATE INDEX "site_menu_revisions_location_status_idx"
  ON "site_menu_revisions"("location", "status");

CREATE TABLE "site_menu_publications" (
  "location" VARCHAR(16) PRIMARY KEY CHECK ("location" IN ('header', 'footer')),
  "revision_id" UUID NOT NULL UNIQUE,
  "published_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "site_menu_publications_revision_owner_fkey"
    FOREIGN KEY ("location", "revision_id")
    REFERENCES "site_menu_revisions"("location", "id") ON DELETE RESTRICT
);

CREATE TABLE "site_media_assets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storage_key" VARCHAR(255) NOT NULL UNIQUE,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(64) NOT NULL CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
  "byte_size" INTEGER NOT NULL CHECK ("byte_size" > 0 AND "byte_size" <= 10485760),
  "width" INTEGER CHECK ("width" > 0),
  "height" INTEGER CHECK ("height" > 0),
  "alt_text" VARCHAR(500) NOT NULL DEFAULT '',
  "uploaded_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ(6)
);

CREATE INDEX "site_media_assets_deleted_at_created_at_idx"
  ON "site_media_assets"("deleted_at", "created_at");

-- Published snapshots cannot be edited or deleted. A new draft/version must
-- be created; the publication pointer changes only in a publish transaction.
CREATE FUNCTION "site_reject_published_revision_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'published' THEN
    RAISE EXCEPTION 'published site revisions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "site_page_revision_immutable"
BEFORE UPDATE OR DELETE ON "site_page_revisions"
FOR EACH ROW EXECUTE FUNCTION "site_reject_published_revision_mutation"();

CREATE TRIGGER "site_menu_revision_immutable"
BEFORE UPDATE OR DELETE ON "site_menu_revisions"
FOR EACH ROW EXECUTE FUNCTION "site_reject_published_revision_mutation"();

-- A publication must point to a published snapshot, never to a live draft.
CREATE FUNCTION "site_check_publication_revision"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE revision_status VARCHAR(16);
BEGIN
  IF TG_TABLE_NAME = 'site_page_publications' THEN
    SELECT "status" INTO revision_status FROM "site_page_revisions"
    WHERE "id" = NEW."revision_id" AND "page_id" = NEW."page_id";
  ELSE
    SELECT "status" INTO revision_status FROM "site_menu_revisions"
    WHERE "id" = NEW."revision_id" AND "location" = NEW."location";
  END IF;
  IF revision_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'publication requires a published revision';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "site_page_publication_guard"
BEFORE INSERT OR UPDATE ON "site_page_publications"
FOR EACH ROW EXECUTE FUNCTION "site_check_publication_revision"();

CREATE TRIGGER "site_menu_publication_guard"
BEFORE INSERT OR UPDATE ON "site_menu_publications"
FOR EACH ROW EXECUTE FUNCTION "site_check_publication_revision"();
