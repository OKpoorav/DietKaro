-- CreateTable
CREATE TABLE "public"."CallNote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CallNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallNote_orgId_idx" ON "public"."CallNote"("orgId");

-- CreateIndex
CREATE INDEX "CallNote_clientId_idx" ON "public"."CallNote"("clientId");

-- CreateIndex
CREATE INDEX "CallNote_clientId_createdAt_idx" ON "public"."CallNote"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."CallNote" ADD CONSTRAINT "CallNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallNote" ADD CONSTRAINT "CallNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallNote" ADD CONSTRAINT "CallNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
