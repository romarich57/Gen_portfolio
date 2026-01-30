-- CreateEnum
CREATE TYPE "SecurityActionType" AS ENUM ('REVOKE_SESSIONS');

-- CreateIndex
CREATE UNIQUE INDEX "users_recovery_email_key" ON "users"("recovery_email");

-- CreateTable
CREATE TABLE "security_action_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "SecurityActionType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "security_action_tokens_token_hash_key" ON "security_action_tokens"("token_hash");
CREATE INDEX "security_action_tokens_user_id_idx" ON "security_action_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "security_action_tokens" ADD CONSTRAINT "security_action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
