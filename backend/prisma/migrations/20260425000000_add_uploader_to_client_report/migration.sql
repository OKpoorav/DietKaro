-- Migration: Add uploader fields to ClientReport
-- Tracks who uploaded each report (client themselves vs dietitian/admin on their behalf).

ALTER TABLE "ClientReport"
    ADD COLUMN "uploadedByUserId" TEXT,
    ADD COLUMN "uploaderRole" TEXT NOT NULL DEFAULT 'client';

-- Existing rows came from the client app; the default 'client' covers them.
-- Forward-only — no data backfill needed beyond the default.

DO $$ BEGIN
    ALTER TABLE "ClientReport"
        ADD CONSTRAINT "ClientReport_uploadedByUserId_fkey"
        FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ClientReport_clientId_uploadedAt_idx"
    ON "ClientReport" ("clientId", "uploadedAt" DESC);
