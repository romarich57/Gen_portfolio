# API_CONTRACT_UI

## Base URLs (DEV HTTPS)
- Front: https://localhost:3000
- API: https://localhost:4000

## CSRF
- GET /auth/csrf
  - Response: `{ csrfToken: string }`
  - Usage: store in memory and send `X-CSRF-Token` on POST/PATCH/DELETE.

## Auth
- POST /auth/register
  - Body: `{ email, password, firstName, lastName, username, nationality, captchaToken? }`
- POST /auth/email/resend
- GET /auth/email/verify?token=
- POST /auth/email/verify
  - Body: `{ confirmation_token }`
- POST /auth/login
  - Body: `{ identifier, password }` (identifier = email ou username)
  - 200 `{ ok: true }` or 200 `{ error: "MFA_CHALLENGE_REQUIRED" }` (si MFA activée)
  - 401 `{ error: "INVALID_CREDENTIALS" }`
  - 403 `{ error: "EMAIL_NOT_VERIFIED" }`
  - 403 `{ error: "MFA_SETUP_REQUIRED" }` (si MFA requise admin)
- POST /auth/logout
- POST /auth/password/reset/request
- POST /auth/password/reset/confirm
- POST /auth/phone/start (body: phoneE164, country optionnel)
- POST /auth/phone/check (body: phoneE164, code, country optionnel)
  - Optionnel (Profil > Sécurité) — nécessite session valide
- POST /auth/mfa/setup/start
- POST /auth/mfa/setup/confirm
- POST /auth/mfa/verify
- GET /auth/oauth/:provider/start
- GET /auth/oauth/:provider/callback
  - Redirects to `/oauth/callback?next=complete-profile|mfa-challenge|setup-mfa|dashboard`
  - On error: `/oauth/callback?status=error`
- GET /auth/recovery-email/verify?token=
- POST /auth/recovery-email/verify
  - Body: `{ confirmation_token }`
- GET /auth/security/revoke-sessions?token=
- POST /auth/security/revoke-sessions
  - Body: `{ confirmation_token }`
- GET /auth/security/acknowledge-alert?token=
- POST /auth/security/acknowledge-alert
  - Body: `{ confirmation_token }`
- GET /auth/email/change/verify?token=
- POST /auth/email/change/verify
  - Body: `{ confirmation_token }`

## /me
- GET /me
  - Response inclut `mfa_enabled`, `mfa_required`, `backup_codes_remaining`
  - Statuts: `email_verified_at`, `phone_verified_at`, `recovery_email_*`
- GET /me/onboarding
- PATCH /me/onboarding
- PATCH /me
- POST /me/sessions/revoke
- POST /me/sessions/revoke-all
- GET /me/sessions
- GET /me/sessions/history
- POST /me/mfa/backup-codes/regenerate
- POST /me/security/alerts
- POST /me/recovery-email
- DELETE /me/recovery-email
- POST /me/gdpr/delete/request (suppression compte)

## Billing
- GET /billing/status
- POST /billing/checkout-session
- POST /billing/portal (alias: /billing/portal-session)

## Admin (support)
- GET /admin/status/services
- GET /admin/status/services/history?limit=20

## UI routing rules
- EMAIL_NOT_VERIFIED => afficher message neutre (pas de resend sans endpoint)
- MFA_CHALLENGE_REQUIRED => redirect /mfa-challenge
- ONBOARDING_REQUIRED => redirect /complete-profile (profil incomplet)

## Pages publiques
- /terms
- /privacy
- /verify-recovery-email
- /security/revoke-sessions
- /security/acknowledge-alert

## Pages privées
- /sessions
