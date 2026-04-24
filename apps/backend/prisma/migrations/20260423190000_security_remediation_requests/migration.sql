CREATE TABLE "email_change_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_email" TEXT NOT NULL,
    "new_email" TEXT NOT NULL,
    "verify_token_hash" TEXT NOT NULL,
    "cancel_token_hash" TEXT NOT NULL,
    "requested_ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_link_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email_at_provider" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "requested_ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_link_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_change_requests_verify_token_hash_key" ON "email_change_requests"("verify_token_hash");
CREATE UNIQUE INDEX "email_change_requests_cancel_token_hash_key" ON "email_change_requests"("cancel_token_hash");
CREATE INDEX "email_change_requests_user_id_idx" ON "email_change_requests"("user_id");
CREATE INDEX "email_change_requests_expires_at_idx" ON "email_change_requests"("expires_at");

CREATE UNIQUE INDEX "oauth_link_requests_token_hash_key" ON "oauth_link_requests"("token_hash");
CREATE UNIQUE INDEX "oauth_link_requests_provider_provider_user_id_key" ON "oauth_link_requests"("provider", "provider_user_id");
CREATE INDEX "oauth_link_requests_user_id_idx" ON "oauth_link_requests"("user_id");
CREATE INDEX "oauth_link_requests_expires_at_idx" ON "oauth_link_requests"("expires_at");

ALTER TABLE "email_change_requests"
ADD CONSTRAINT "email_change_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauth_link_requests"
ADD CONSTRAINT "oauth_link_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
