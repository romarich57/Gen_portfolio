# PROFILE_SPEC

## Endpoints

### GET /me
Auth: cookie HttpOnly
Returns:
- id, email
- has_password
- first_name, last_name, username, nationality, locale
- roles
- avatar_url (signed GET, short TTL)
- mfa_enabled, mfa_required
- email_verified_at, phone_verified_at
- recovery_email, recovery_email_pending, recovery_email_verified_at
- security_alert_email_enabled, security_alert_sms_enabled
- backup_codes_remaining
- onboarding_completed_at

### PATCH /me/onboarding
Auth: yes
CSRF: yes
Input (required):
- first_name (1–64)
- last_name (1–64)
- username (regex `^[a-zA-Z0-9_]{3,30}$`)
- nationality (ISO2, uppercase)
Rules:
- username unique
- sets `onboarding_completed_at` when complete
Errors: VALIDATION_ERROR, USERNAME_TAKEN
Audit: ONBOARDING_COMPLETED

### GET /me/onboarding
Auth: yes
Returns:
- completed (bool)
- missing_fields[]
- onboarding_completed_at

### PATCH /me
Auth: yes
CSRF: yes
Input (optional):
- first_name, last_name, username, nationality, locale
Rules:
- username modifiable unlimited times, validated + unique
Errors: VALIDATION_ERROR, USERNAME_TAKEN
Audit: PROFILE_UPDATED

### POST /me/consents
Auth: yes
CSRF: yes
Input:
- analytics_enabled (bool)
- ads_enabled (bool)
- consent_version (ex: "v1")
- source (signup|settings|banner)
Audit: CONSENTS_UPDATED

### GET /me/sessions
Auth: yes
Returns:
- sessions[]: id, created_at, last_used_at, expires_at, ip, user_agent, current

### POST /me/sessions/revoke
Auth: yes
CSRF: yes
Input:
- session_id (string)
Audit: SESSION_REVOKED

### POST /me/sessions/revoke-all
Auth: yes
CSRF: yes
Input:
- include_current (bool, optional, default true)
Audit: SESSIONS_REVOKED_ALL

### POST /me/mfa/backup-codes/regenerate
Auth: yes
CSRF: yes
Requires: MFA recent (step-up)
Returns:
- backup_codes[]
Audit: BACKUP_CODES_REGENERATED

### POST /me/security/alerts
Auth: yes
CSRF: yes
Input:
- email_enabled (bool)
- sms_enabled (bool)
Rules:
- sms_enabled requires phone_verified_at
Audit: SECURITY_ALERTS_UPDATED

### POST /me/recovery-email
Auth: yes
CSRF: yes
Input:
- email (string)
- password (optional, required if password exists)
Rules:
- MFA recent if enabled
Returns:
- ok, email_sent
Audit: RECOVERY_EMAIL_REQUESTED

### DELETE /me/recovery-email
Auth: yes
CSRF: yes
Input:
- password (optional, required if password exists)
Rules:
- MFA recent if enabled
Audit: RECOVERY_EMAIL_REMOVED

### GET /auth/recovery-email/verify
Auth: no
Input:
- token (query)
Effect:
- sets recovery_email + recovery_email_verified_at
Audit: RECOVERY_EMAIL_VERIFIED

## Onboarding rules
- Comptes non‑OAuth: champs profil requis pour activer `onboarding_completed_at`.
- Comptes OAuth: champs peuvent être vides à la création, mais accès produit bloqué tant que `onboarding_completed_at` est null.

## Username
- Changements illimités
- Validation stricte (regex ci‑dessus)
- Unicité DB

## Erreurs neutres
- Pas de fuite d’existence d’utilisateur.
