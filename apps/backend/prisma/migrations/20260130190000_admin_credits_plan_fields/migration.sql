-- Add credits balance to users
ALTER TABLE "users" ADD COLUMN "credits_balance" INTEGER NOT NULL DEFAULT 0;

-- Add plan fields for admin management
ALTER TABLE "plans" ADD COLUMN "stripe_product_id" TEXT;
ALTER TABLE "plans" ADD COLUMN "project_limit" INTEGER;
ALTER TABLE "plans" ADD COLUMN "credits_monthly" INTEGER;

-- Create credits ledger
CREATE TABLE "credits_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credits_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credits_ledger_user_id_idx" ON "credits_ledger"("user_id");

ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
