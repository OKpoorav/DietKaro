-- CreateEnum
CREATE TYPE "public"."RecurrenceUnit" AS ENUM ('day', 'week', 'month', 'year');
-- CreateEnum
CREATE TYPE "public"."SubscriptionState" AS ENUM ('active', 'paused', 'deactivated');
-- CreateEnum
CREATE TYPE "public"."PaymentState" AS ENUM ('paid', 'unpaid');
-- CreateEnum
CREATE TYPE "public"."PaymentTxStatus" AS ENUM ('pending', 'succeeded', 'failed', 'expired');
-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('razorpay_link', 'razorpay_checkout', 'manual_cash', 'manual_upi', 'manual_bank', 'manual_other', 'mark_active');
-- CreateTable
CREATE TABLE "public"."SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recurrenceUnit" "public"."RecurrenceUnit" NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "durationDays" INTEGER NOT NULL,
    "costInr" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "public"."ClientSubscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "activeDate" DATE NOT NULL,
    "renewalDate" DATE NOT NULL,
    "status" "public"."SubscriptionState" NOT NULL DEFAULT 'active',
    "paymentStatus" "public"."PaymentState" NOT NULL DEFAULT 'unpaid',
    "pausedUntil" DATE,
    "pausedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "lastPaidAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientSubscription_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSubscriptionId" TEXT,
    "amountInr" DECIMAL(10,2) NOT NULL,
    "status" "public"."PaymentTxStatus" NOT NULL DEFAULT 'pending',
    "method" "public"."PaymentMethod" NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpayLinkId" TEXT,
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "rawPayload" JSONB,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "SubscriptionPlan_orgId_active_idx" ON "public"."SubscriptionPlan"("orgId", "active");
-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_orgId_name_key" ON "public"."SubscriptionPlan"("orgId", "name");
-- CreateIndex
CREATE UNIQUE INDEX "ClientSubscription_clientId_key" ON "public"."ClientSubscription"("clientId");
-- CreateIndex
CREATE INDEX "ClientSubscription_renewalDate_idx" ON "public"."ClientSubscription"("renewalDate");
-- CreateIndex
CREATE INDEX "ClientSubscription_status_paymentStatus_idx" ON "public"."ClientSubscription"("status", "paymentStatus");
-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "public"."Payment"("razorpayPaymentId");
-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayLinkId_key" ON "public"."Payment"("razorpayLinkId");
-- CreateIndex
CREATE INDEX "Payment_orgId_createdAt_idx" ON "public"."Payment"("orgId", "createdAt");
-- CreateIndex
CREATE INDEX "Payment_clientId_createdAt_idx" ON "public"."Payment"("clientId", "createdAt");
-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "public"."Payment"("status");
-- AddForeignKey
ALTER TABLE "public"."SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."ClientSubscription" ADD CONSTRAINT "ClientSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."ClientSubscription" ADD CONSTRAINT "ClientSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."ClientSubscription" ADD CONSTRAINT "ClientSubscription_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_clientSubscriptionId_fkey" FOREIGN KEY ("clientSubscriptionId") REFERENCES "public"."ClientSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
