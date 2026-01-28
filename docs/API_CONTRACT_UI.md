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
- POST /auth/email/resend
- GET /auth/email/verify?token=
- POST /auth/login
  - 200 `{ ok: true }` or 200 `{ error: "MFA_CHALLENGE_REQUIRED" }`
  - 401 `{ error: "INVALID_CREDENTIALS" }`
  - 403 `{ error: "EMAIL_NOT_VERIFIED" | "PHONE_NOT_VERIFIED" | "MFA_SETUP_REQUIRED" }`
- POST /auth/logout
- POST /auth/password/reset/request
- POST /auth/password/reset/confirm
- POST /auth/phone/start
- POST /auth/phone/check
- POST /auth/mfa/setup/start
- POST /auth/mfa/setup/confirm
- POST /auth/mfa/verify
- GET /auth/oauth/:provider/start
- GET /auth/oauth/:provider/callback
  - Redirects to `/oauth/callback?next=verify-email|verify-phone|setup-mfa|mfa-challenge|dashboard|profile`

## /me
- GET /me
- GET /me/onboarding
- PATCH /me/onboarding
- PATCH /me

## Billing
- GET /billing/status
- POST /billing/checkout-session
- POST /billing/portal (alias: /billing/portal-session)

## UI routing rules
- EMAIL_NOT_VERIFIED => afficher message neutre (pas de resend sans endpoint)
- PHONE_NOT_VERIFIED => redirect /verify-phone
- MFA_SETUP_REQUIRED => redirect /setup-mfa
- MFA_CHALLENGE_REQUIRED => redirect /mfa-challenge
- ONBOARDING_REQUIRED => redirect /profile (bloc onboarding)
