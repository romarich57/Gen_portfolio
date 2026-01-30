-- Add new enum values
ALTER TYPE "UserRole" ADD VALUE 'vip';
ALTER TYPE "AuthAttemptType" ADD VALUE 'billing_checkout';

-- New enums
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PREMIUM', 'VIP');
CREATE TYPE "Currency" AS ENUM ('EUR');
CREATE TYPE "BillingInterval" AS ENUM ('month');
CREATE TYPE "SubscriptionStatus" AS ENUM ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE "WebhookStatus" AS ENUM ('processed', 'ignored', 'failed');
CREATE TYPE "RoleType" AS ENUM ('premium', 'vip');

-- Plans
CREATE TABLE "plans" (
  "id" TEXT NOT NULL,
  "code" "PlanCode" NOT NULL,
  "name" TEXT NOT NULL,
  "currency" "Currency" NOT NULL,
  "stripe_price_id" TEXT,
  "amount_cents" INTEGER NOT NULL,
  "interval" "BillingInterval" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "features_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- Stripe customers
CREATE TABLE "stripe_customers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_customers_user_id_key" ON "stripe_customers"("user_id");
CREATE UNIQUE INDEX "stripe_customers_stripe_customer_id_key" ON "stripe_customers"("stripe_customer_id");
CREATE INDEX "stripe_customers_user_id_idx" ON "stripe_customers"("user_id");

ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscriptions
CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "plan_code" "PlanCode" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "currency" "Currency" NOT NULL,
  "stripe_subscription_id" TEXT,
  "current_period_start" TIMESTAMP(3) NOT NULL,
  "current_period_end" TIMESTAMP(3) NOT NULL,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "canceled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions"("stripe_subscription_id");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payments
CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "stripe_checkout_session_id" TEXT,
  "stripe_invoice_id" TEXT,
  "stripe_payment_intent_id" TEXT,
  "amount_cents" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL,
  "status" "PaymentStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_key" ON "payments"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "payments_stripe_invoice_id_key" ON "payments"("stripe_invoice_id");
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Entitlements
CREATE TABLE "entitlements" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "projects_limit" INTEGER,
  "projects_used" INTEGER NOT NULL DEFAULT 0,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "entitlements_user_id_key" ON "entitlements"("user_id");
CREATE INDEX "entitlements_user_id_idx" ON "entitlements"("user_id");

ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Webhook events
CREATE TABLE "webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "status" "WebhookStatus" NOT NULL,
  "error_message" TEXT,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events"("provider");

-- Role grants
CREATE TABLE "role_grants" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "RoleType" NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "reason" TEXT,

  CONSTRAINT "role_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "role_grants_user_id_idx" ON "role_grants"("user_id");
CREATE UNIQUE INDEX "role_grants_user_id_role_active_key" ON "role_grants"("user_id", "role")
  WHERE "revoked_at" IS NULL;

ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed plans (placeholders for stripe_price_id)
INSERT INTO "plans" ("id", "code", "name", "currency", "stripe_price_id", "amount_cents", "interval", "is_active", "features_json", "created_at", "updated_at")
VALUES
  ('plan_free', 'FREE', 'Free', 'EUR', NULL, 0, 'month', true, '{"projects_limit":1}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_premium', 'PREMIUM', 'Premium', 'EUR', 'price_premium_eur', 1000, 'month', true, '{"projects_limit":5}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_vip', 'VIP', 'VIP', 'EUR', 'price_vip_eur', 3000, 'month', true, '{"projects_limit":null}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
