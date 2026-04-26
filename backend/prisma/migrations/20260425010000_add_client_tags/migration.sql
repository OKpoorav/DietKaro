-- Migration: Client smart tags (org-wide master + assignments)
-- Tag MASTER is org-scoped, admin-managed.
-- Default 5 tags are seeded lazily on first list call (see tags.service.ts) so
-- existing orgs are backfilled without a manual run.

CREATE TABLE "ClientTag" (
    "id"              TEXT          NOT NULL,
    "orgId"           TEXT          NOT NULL,
    "name"            TEXT          NOT NULL,
    "color"           TEXT          NOT NULL DEFAULT 'green',
    "keywords"        TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active"          BOOLEAN       NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)  NOT NULL,
    "deletedAt"       TIMESTAMP(3),
    CONSTRAINT "ClientTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientTag_orgId_name_key" ON "ClientTag" ("orgId", "name");
CREATE INDEX "ClientTag_orgId_active_idx" ON "ClientTag" ("orgId", "active");

ALTER TABLE "ClientTag"
    ADD CONSTRAINT "ClientTag_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientTag"
    ADD CONSTRAINT "ClientTag_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClientTagAssignment" (
    "clientId"         TEXT          NOT NULL,
    "tagId"            TEXT          NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientTagAssignment_pkey" PRIMARY KEY ("clientId", "tagId")
);

CREATE INDEX "ClientTagAssignment_clientId_idx" ON "ClientTagAssignment" ("clientId");
CREATE INDEX "ClientTagAssignment_tagId_idx" ON "ClientTagAssignment" ("tagId");

ALTER TABLE "ClientTagAssignment"
    ADD CONSTRAINT "ClientTagAssignment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientTagAssignment"
    ADD CONSTRAINT "ClientTagAssignment_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "ClientTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientTagAssignment"
    ADD CONSTRAINT "ClientTagAssignment_assignedByUserId_fkey"
    FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
