-- CV Genius resume domain and AI usage tracking.

ALTER TYPE "JobType" ADD VALUE 'RESUME_EXPORT';
ALTER TYPE "JobType" ADD VALUE 'RESUME_IMPORT_PARSE';
ALTER TYPE "JobType" ADD VALUE 'RESUME_PURGE_ASSETS';

CREATE TYPE "ResumeStatus" AS ENUM ('draft', 'generated', 'edited', 'archived', 'deleted');
CREATE TYPE "ResumeAssetKind" AS ENUM ('photo', 'certificate', 'import_source', 'export', 'other');
CREATE TYPE "ResumeExportFormat" AS ENUM ('pdf', 'json', 'markdown', 'zip');
CREATE TYPE "ResumeExportStatus" AS ENUM ('queued', 'building', 'ready', 'failed', 'expired');
CREATE TYPE "ResumeImportStatus" AS ENUM ('queued', 'parsing', 'ready', 'failed');
CREATE TYPE "AiUsageStatus" AS ENUM ('succeeded', 'failed', 'rate_limited');
CREATE TYPE "AiOperation" AS ENUM ('resume_import', 'resume_polish', 'resume_grammar');

ALTER TABLE "plans" ADD COLUMN "resume_limit" INTEGER;
ALTER TABLE "plans" ADD COLUMN "ai_credits_monthly" INTEGER;
ALTER TABLE "plans" ADD COLUMN "export_limit_monthly" INTEGER;
ALTER TABLE "entitlements" ADD COLUMN "resume_limit" INTEGER;
ALTER TABLE "entitlements" ADD COLUMN "resumes_used" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "entitlements" ADD COLUMN "ai_credits_monthly" INTEGER;
ALTER TABLE "entitlements" ADD COLUMN "exports_limit_monthly" INTEGER;

UPDATE "plans" SET "resume_limit" = "project_limit" WHERE "resume_limit" IS NULL;
UPDATE "entitlements" SET "resume_limit" = "projects_limit", "resumes_used" = "projects_used" WHERE "resume_limit" IS NULL;

CREATE TABLE "resumes" (
  "id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'fr',
  "template_id" TEXT,
  "status" "ResumeStatus" NOT NULL DEFAULT 'draft',
  "data_json" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resume_versions" (
  "id" TEXT NOT NULL,
  "resume_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "data_json" JSONB NOT NULL,
  "checksum" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resume_assets" (
  "id" TEXT NOT NULL,
  "resume_id" TEXT NOT NULL,
  "file_id" UUID NOT NULL,
  "kind" "ResumeAssetKind" NOT NULL,
  "alt_text" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "resume_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resume_exports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "resume_id" TEXT NOT NULL,
  "file_id" UUID,
  "format" "ResumeExportFormat" NOT NULL,
  "status" "ResumeExportStatus" NOT NULL DEFAULT 'queued',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "error_message" TEXT,
  CONSTRAINT "resume_exports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resume_imports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "resume_id" TEXT,
  "file_id" UUID,
  "status" "ResumeImportStatus" NOT NULL DEFAULT 'queued',
  "source_text" TEXT,
  "parsed_json" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resume_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_usage_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "operation" "AiOperation" NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "AiUsageStatus" NOT NULL,
  "input_chars" INTEGER NOT NULL DEFAULT 0,
  "image_count" INTEGER NOT NULL DEFAULT 0,
  "credits_debited" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "error_code" TEXT,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resumes_owner_user_id_updated_at_idx" ON "resumes"("owner_user_id", "updated_at");
CREATE INDEX "resumes_owner_user_id_status_idx" ON "resumes"("owner_user_id", "status");
CREATE UNIQUE INDEX "resume_versions_resume_id_version_key" ON "resume_versions"("resume_id", "version");
CREATE INDEX "resume_versions_resume_id_idx" ON "resume_versions"("resume_id");
CREATE INDEX "resume_assets_resume_id_idx" ON "resume_assets"("resume_id");
CREATE INDEX "resume_assets_file_id_idx" ON "resume_assets"("file_id");
CREATE INDEX "resume_exports_user_id_requested_at_idx" ON "resume_exports"("user_id", "requested_at");
CREATE INDEX "resume_exports_resume_id_idx" ON "resume_exports"("resume_id");
CREATE INDEX "resume_imports_user_id_created_at_idx" ON "resume_imports"("user_id", "created_at");
CREATE INDEX "resume_imports_resume_id_idx" ON "resume_imports"("resume_id");
CREATE INDEX "ai_usage_events_user_created_at_idx" ON "ai_usage_events"("user_id", "created_at");

ALTER TABLE "resumes" ADD CONSTRAINT "resumes_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_assets" ADD CONSTRAINT "resume_assets_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_assets" ADD CONSTRAINT "resume_assets_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_exports" ADD CONSTRAINT "resume_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_exports" ADD CONSTRAINT "resume_exports_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_exports" ADD CONSTRAINT "resume_exports_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
