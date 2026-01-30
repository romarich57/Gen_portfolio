-- Add enum value
ALTER TYPE "AuthAttemptType" ADD VALUE 'gdpr_export';

-- New enums
CREATE TYPE "FileKind" AS ENUM ('avatar', 'gdpr_export', 'import', 'other');
CREATE TYPE "FileStatus" AS ENUM ('pending', 'active', 'deleted');
CREATE TYPE "GdprExportStatus" AS ENUM ('queued', 'building', 'ready', 'failed', 'expired');
CREATE TYPE "DeletionRequestStatus" AS ENUM ('requested', 'scheduled', 'completed', 'failed');
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');
CREATE TYPE "JobType" AS ENUM ('GDPR_EXPORT', 'GDPR_PURGE');
CREATE TYPE "ConsentSource" AS ENUM ('signup', 'settings', 'banner');

-- Ensure uuid support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Files
CREATE TABLE "files" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" TEXT NOT NULL,
  "kind" "FileKind" NOT NULL,
  "bucket" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum_sha256" TEXT,
  "status" "FileStatus" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "files_object_key_key" ON "files"("object_key");
CREATE INDEX "files_owner_user_id_idx" ON "files"("owner_user_id");

ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Users profile fields
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN "username" TEXT;
ALTER TABLE "users" ADD COLUMN "nationality" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_file_id" UUID;
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_avatar_file_id_key" ON "users"("avatar_file_id");

ALTER TABLE "users" ADD CONSTRAINT "users_avatar_file_id_fkey"
  FOREIGN KEY ("avatar_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- GDPR exports
CREATE TABLE "gdpr_exports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "file_id" UUID,
  "status" "GdprExportStatus" NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "error_message" TEXT,

  CONSTRAINT "gdpr_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gdpr_exports_user_id_idx" ON "gdpr_exports"("user_id");
CREATE INDEX "gdpr_exports_status_idx" ON "gdpr_exports"("status");
CREATE UNIQUE INDEX "gdpr_exports_file_id_key" ON "gdpr_exports"("file_id");

ALTER TABLE "gdpr_exports" ADD CONSTRAINT "gdpr_exports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gdpr_exports" ADD CONSTRAINT "gdpr_exports_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deletion requests
CREATE TABLE "deletion_requests" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "DeletionRequestStatus" NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduled_for" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "error_message" TEXT,

  CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deletion_requests_user_id_idx" ON "deletion_requests"("user_id");
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests"("status");

ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jobs
CREATE TABLE "jobs" (
  "id" TEXT NOT NULL,
  "type" "JobType" NOT NULL,
  "payload_json" JSONB NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "run_after" TIMESTAMP(3) NOT NULL,
  "locked_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "jobs_status_run_after_idx" ON "jobs"("status", "run_after");

-- Consents (replace legacy)
DROP TABLE IF EXISTS "consents";

CREATE TABLE "consents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "analytics_enabled" BOOLEAN NOT NULL,
  "ads_enabled" BOOLEAN NOT NULL,
  "consent_version" TEXT NOT NULL,
  "consented_at" TIMESTAMP(3) NOT NULL,
  "source" "ConsentSource" NOT NULL,
  "ip_hash" TEXT,
  "user_agent_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consents_user_id_idx" ON "consents"("user_id");

ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
