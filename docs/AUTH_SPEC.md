# AUTH_SPEC

## Conventions
- Toutes les requêtes state‑changing exigent `X-CSRF-Token` + cookie `csrf_token` et `Origin` allowlist.
- Cookies HttpOnly: `access_token` (15 min) et `refresh_token` (30 jours, rotation).
- Réponses d’erreurs neutres (anti‑énumération).
- `request_id` présent dans chaque réponse JSON.

## Endpoints

### POST /auth/register
Input:
```json
{
  "email": "user@example.com",
  "password": "StrongPassw0rd!",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "username": "ada.lovelace",
  "nationality": "FR",
  "captchaToken": "..."
}
```
Output: `201` + message neutre.
Rate limit: 3 req/min/IP.
Audit: `REGISTER_ATTEMPT`, `REGISTER_SUCCESS`.

### POST /auth/email/resend
Input:
```json
{ "email": "user@example.com" }
```
Toujours reponse neutre.
Rate limit: 3 req/min/IP.
Audit: `EMAIL_VERIFICATION_RESEND`.

### POST /auth/login
Input:
```json
{ "identifier": "user@example.com | username", "password": "StrongPassw0rd!", "captchaToken": "..." }
```
Output:
- `200` + cookies si OK
- `200` + `MFA_CHALLENGE_REQUIRED` si MFA activée
- `403` + `MFA_SETUP_REQUIRED` si MFA requise (flag admin) et non configurée
- `403` + code `EMAIL_NOT_VERIFIED`
- `401` neutre si mauvais identifiants
Rate limit: 5 req/min/IP + 5 req/min/account.
Audit: `LOGIN_SUCCESS` / `LOGIN_FAIL` (metadata `reason`).

### POST /auth/logout
Révoque session + supprime cookies. `204`.
Audit: `LOGOUT`.

### POST /auth/refresh
Rotation refresh + nouveaux cookies.
- `401` si expiré/révoqué
- `401` + `REFRESH_REUSE_DETECTED` si réutilisation
- `403` + `MFA_SETUP_REQUIRED` si MFA requise (flag admin) et non configurée
Rate limit: 10 req/min/session.
Audit: `REFRESH_ROTATED`.

### GET /auth/csrf
Retourne un token CSRF + set cookie `csrf_token`.

### GET /auth/email/verify?token=...
Valide token email. Met user `active` (email vérifié). Aucun onboarding phone imposé.
Audit: `EMAIL_VERIFIED`.

### GET /auth/recovery-email/verify?token=...
Valide l'email de recuperation.
Audit: `RECOVERY_EMAIL_VERIFIED`.

### POST /auth/password/reset/request
Input: `{ "email": "..." }`.
Toujours réponse neutre.
Audit: `RESET_REQUESTED`.

### POST /auth/password/reset/confirm
Input: `{ "token": "...", "newPassword": "..." }`.
Réinitialise le mot de passe + révoque toutes sessions.
Audit: `PASSWORD_RESET_SUCCESS`.

### POST /auth/phone/start
Input: `{ "phoneE164": "+15555550123", "country": "FR" }` (country optionnel).
Nécessite session authentifiée (optionnel, pas bloquant).
Rate limit: 2 req/min/IP (configurable via `app_settings.otp_rate_limits`).
Audit: `PHONE_VERIFY_START`.

### POST /auth/phone/check
Input: `{ "phoneE164": "+15555550123", "code": "123456", "country": "FR" }` (country optionnel).
Nécessite session authentifiée.
Si OK: `phoneVerifiedAt` mis à jour (statut `active`).
Lockout si trop d’essais (`PHONE_VERIFY_LOCKED`).
Audit: `PHONE_VERIFIED` / `PHONE_VERIFY_FAILED` / `PHONE_VERIFY_LOCKED`.

### POST /auth/mfa/setup/start
Nécessite session authentifiée (Profil > Sécurité).
Retourne `otpauthUrl`.
Audit: `MFA_SETUP_START`.

### POST /auth/mfa/setup/confirm
Input: `{ "code": "123456" }`.
Active MFA + génère backup codes + session.
Audit: `MFA_ENABLED`.

### POST /auth/mfa/verify
Input: `{ "code": "123456" }`.
Valide code TOTP ou backup code; délivre session.
Audit: `MFA_CHALLENGE_SUCCESS` / `MFA_CHALLENGE_FAIL`.

### GET /auth/oauth/:provider/start
Redirection vers Google/GitHub avec PKCE + state/nonce.
Audit: `OAUTH_START`.

### GET /auth/oauth/:provider/callback
Échange code + profil. Crée/lie user (email OAuth **doit être vérifié**). Redirige vers front:
`/oauth/callback?next=complete-profile|mfa-challenge|setup-mfa|dashboard`.
Audit: `OAUTH_CALLBACK_SUCCESS/FAIL`.

## Flows onboarding
1) Register -> email verify
2) Email verified -> login
3) Profil complet requis -> dashboard
4) MFA imposée si flag admin `mfa_required_global` (ou override user) + setup via `/setup-mfa`
5) Téléphone optionnel via Profil > Sécurité

## Admin Security (RBAC admin/super_admin)

### GET /admin/security/mfa-flags
Retourne `mfaRequiredGlobal` + `allowDisableMfa`.

### PUT /admin/security/mfa-flags
Input:
```json
{ "mfaRequiredGlobal": true, "allowDisableMfa": false }
```
Audit: `ADMIN_MFA_FLAGS_UPDATED`.

### PATCH /admin/users/:id/mfa-override
Input:
```json
{ "required": true }
```
Audit: `ADMIN_USER_MFA_OVERRIDE`.

### GET /admin/security/otp-rate-limits
Retourne la config courante.

### PUT /admin/security/otp-rate-limits
Input:
```json
{
  "phoneStart": { "windowMs": 60000, "limit": 2 },
  "phoneCheck": { "windowMs": 60000, "limit": 5, "maxAttempts": 5 }
}
```
Audit: `ADMIN_OTP_RATE_LIMITS_UPDATED`.

## Cookies
- `access_token` (HttpOnly, Secure, SameSite=Strict)
- `refresh_token` (HttpOnly, Secure, SameSite=Strict)
- `csrf_token` (non HttpOnly)
- `onboarding_token` (HttpOnly, strict)
- `mfa_challenge` (HttpOnly, strict)
