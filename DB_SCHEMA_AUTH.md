# DB_SCHEMA_AUTH

## Tables principales

### users
- `id` (PK)
- `email` (unique)
- `password_hash` (nullable)
- `status`: pending_email | pending_phone | pending_mfa | active | banned
- `roles`: user | premium | admin | super_admin (array)
- `email_verified_at`, `phone_verified_at`
- `mfa_enabled` (bool)
- `mfa_required_override` (bool nullable)
- `deleted_at` (RGPD)

### oauth_accounts
- `provider` (google|github)
- `provider_user_id`
- `user_id` (FK)
- `email_at_provider`
- unique(provider, provider_user_id)

### sessions
- `refresh_token_hash` (unique)
- `expires_at`, `rotated_at`, `revoked_at`
- `replaced_by_session_id` (self‑FK)
- `ip`, `user_agent`, `device_fingerprint`
- `last_used_at`

### email_verification_tokens / password_reset_tokens
- `token_hash` (unique)
- `expires_at`, `used_at`

### phone_verifications
- `phone_e164`, `provider_sid`, `status`, `attempts`, `expires_at`

### mfa_factors
- `type` = TOTP
- `secret_encrypted` (AES‑256‑GCM)
- `enabled_at`, `last_used_at`

### backup_codes
- `code_hash` (unique), `used_at`

### auth_attempts
- `type` (login/phone_start/phone_check)
- `email`, `ip`, `user_agent`, `success`, `created_at`

### feature_flags
- `key` (unique)
- `value_boolean`
- flags: `mfa_required_global`, `allow_disable_mfa`

### app_settings
- `key` (unique)
- `value_json`
- config: `otp_rate_limits`

## Règles sensibles
- Tokens (email verify / reset / refresh) **stockés hashés** (HMAC SHA‑256).
- Secrets TOTP **chiffrés** via AES‑256‑GCM (master key env).
- Backup codes **hashés** + one‑time.

## Indexes
- `users.email` unique
- `sessions.refresh_token_hash` unique
- `oauth_accounts` unique composite
- Indexes sur `created_at` et FK pour les scans.
