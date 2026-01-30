-- AlterTable
ALTER TABLE "users" ADD COLUMN     "recovery_email" TEXT,
ADD COLUMN     "recovery_email_pending" TEXT,
ADD COLUMN     "recovery_email_verified_at" TIMESTAMP(3),
ADD COLUMN     "security_alert_email_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "security_alert_sms_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "recovery_email_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recovery_email_tokens_token_hash_key" ON "recovery_email_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "recovery_email_tokens_user_id_idx" ON "recovery_email_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "recovery_email_tokens" ADD CONSTRAINT "recovery_email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
