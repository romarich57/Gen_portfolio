# Feature 01 — Auth complète + Email SMTP + Twilio Verify + MFA TOTP + OAuth (PKCE)
Dépendance: Feature 00 validée.

Objectif: implémenter un système d’authentification "Enterprise-grade" avec:
- Register/Login classique
- Vérification email via Gmail SMTP (App Password)
- Vérification téléphone via Twilio Verify
- MFA TOTP obligatoire pour tous (paramétrable par admin)
- OAuth Google + GitHub (Authorization Code + PKCE)
- Sessions: access JWT 15 min + refresh opaque hashé DB, rotation + reuse detection
- CSRF: Origin/Referer strict + CSRF token

---

## A) Livrables attendus
Créer/mettre à jour:

1) `AUTH_SPEC.md`
- Endpoints, payloads, erreurs neutres, rate limits, edge cases
- Flows onboarding (email -> phone -> mfa -> dashboard)

2) `DB_SCHEMA_AUTH.md`
- Prisma schema + migrations
- Indices, uniques, FK
- Token hashing + secret encryption

3) `EMAIL_SMTP_GMAIL.md`
- Setup Gmail App Password, templates email, anti-phishing

4) `TWILIO_VERIFY.md`
- Endpoints start/check + limites + lockouts + erreurs

5) `MFA_TOTP.md`
- Setup MFA, verify code, backup codes, step-up auth

6) `OAUTH_GOOGLE_GITHUB.md`
- Flows PKCE, state/nonce, linking rules

7) Tests:
- Unit + Integration + Security tests (CSRF, refresh reuse, rate-limit, anti-enum)
- Tests d’onboarding: user non-verified ne peut pas accéder routes privées

---

## B) Modèle de données (Prisma) — strict
### B1) Tables minimales
- users:
  - id, email (unique), password_hash (nullable si OAuth-only)
  - status: pending_email | pending_phone | pending_mfa | active | banned
  - roles: user/premium/admin/super_admin (ou via table)
  - email_verified_at, phone_verified_at
  - mfa_enabled (bool), locale
  - deleted_at (RGPD)
  - created_at, updated_at

- oauth_accounts:
  - provider (google|github), provider_user_id, user_id (FK)
  - email_at_provider, linked_at
  - unique(provider, provider_user_id)

- sessions:
  - id, user_id (FK)
  - refresh_token_hash (unique)
  - created_at, expires_at
  - rotated_at, revoked_at
  - replaced_by_session_id (nullable)
  - ip, user_agent
  - device_fingerprint (optionnel)
  - last_used_at

- email_verification_tokens:
  - user_id, token_hash (unique), expires_at, used_at

- password_reset_tokens:
  - user_id, token_hash (unique), expires_at, used_at

- phone_verifications:
  - user_id, phone_e164, provider_sid, status, attempts, expires_at

- mfa_factors:
  - user_id, type=TOTP
  - secret_encrypted
  - enabled_at, last_used_at

- backup_codes:
  - user_id, code_hash, used_at

- audit_logs:
  - append-only (déjà en Feature 00)

- feature_flags / app_settings:
  - mfa_required_global: boolean (default true)
  - allow_disable_mfa: boolean (admin)
  - otp_rate_limits: config

### B2) Règles stockage sensibles
- Tous tokens (email verify, reset, refresh) stockés **hashés** (jamais en clair).
- secret TOTP stocké **chiffré** (envelope encryption avec une master key env).
- backup codes stockés **hashés**, one-time.

---

## C) Endpoints & règles strictes

### C1) Auth classique
#### POST /auth/register
Input: email, password
- Hash Argon2id
- Create user status=pending_email
- Create email_verification_token (hash, expires)
- Send email SMTP
Output: 201 + message générique

Rate limit: strict
Audit: REGISTER_ATTEMPT + REGISTER_SUCCESS (ne jamais log le password)

#### POST /auth/login
Input: email, password (+ captcha token si requis)
- Erreur neutre si mauvais
- Si banned => erreur neutre
- Si pending_email => 403 + code "EMAIL_NOT_VERIFIED"
- Si pending_phone => 403 + code "PHONE_NOT_VERIFIED"
- Si pending_mfa => 403 + code "MFA_SETUP_REQUIRED"
- Sinon: créer session + set cookies (access + refresh)
- Si mfa_enabled: répondre "MFA_CHALLENGE_REQUIRED" et ne finaliser l’accès qu’après /auth/mfa/verify (selon design)
Audit: LOGIN_SUCCESS/FAIL + reason code

Rate limit + captcha adaptatif

#### POST /auth/logout
- Révoquer session côté DB
- Clear cookies
Audit: LOGOUT

#### POST /auth/refresh
- Lire refresh cookie
- Hasher + comparer à DB
- Si expiré/révoqué => 401
- Si refresh reuse détecté => révoquer toutes sessions user + audit incident
- Sinon:
  - créer nouvelle session (ou rotate hash)
  - set nouveaux cookies
Audit: REFRESH_ROTATED

### C2) CSRF
#### GET /auth/csrf
- Générer CSRF token + associer à session (ou double-submit)
- Retourner token au front
Sur chaque state-changing request:
- vérifier Origin/Referer strict
- vérifier X-CSRF-Token valide

### C3) Vérification email (SMTP Gmail)
#### GET /auth/email/verify?token=...
- token usage unique + expiration
- set email_verified_at
- set status=pending_phone
Audit: EMAIL_VERIFIED

### C4) Reset password
#### POST /auth/password/reset/request
- Input: email
- Toujours réponse neutre (anti-enum)
- Si user existe: créer token reset hash + email
Audit: RESET_REQUESTED (ne pas révéler)

#### POST /auth/password/reset/confirm
- Input: token, new_password
- Vérifier token hash + expiration + unused
- Set new password hash
- Invalider toutes sessions
Audit: PASSWORD_RESET_SUCCESS

### C5) Phone verify (Twilio Verify)
#### POST /auth/phone/start
- Input: phone_e164
- Appeler Twilio Verify start
- Stocker provider_sid + status
- Rate limit + lockout si abus
Audit: PHONE_VERIFY_START

#### POST /auth/phone/check
- Input: phone_e164, code
- Appeler Twilio Verify check
- Si ok: set phone_verified_at, status=pending_mfa
Audit: PHONE_VERIFIED / PHONE_VERIFY_FAILED

### C6) MFA TOTP (obligatoire pour tous, admin configurable)
#### POST /auth/mfa/setup/start
- Condition: email_verified + phone_verified
- Générer secret TOTP, chiffrer, stocker "pending"
- Retourner QR provisioning URI (ou otpauth url)
Audit: MFA_SETUP_START

#### POST /auth/mfa/setup/confirm
- Input: code TOTP
- Vérifier code
- Activer mfa_enabled=true, enabled_at
- Générer backup codes (hashés)
- status=active
Audit: MFA_ENABLED

#### POST /auth/mfa/verify
- Input: code
- Utilisé lors login step-up
- En cas de succès: délivrer access cookie (ou marquer session "mfa_ok")
Audit: MFA_CHALLENGE_SUCCESS/FAIL

Admin feature flag:
- mfa_required_global default true
- si désactivé, l’utilisateur peut être `active` sans MFA (mais log + audit)
- possibilité d’obliger MFA par user même si global off

### C7) OAuth Google + GitHub (Code + PKCE)
Endpoints:
- GET /auth/oauth/:provider/start
- GET /auth/oauth/:provider/callback

Règles:
- Générer code_verifier/challenge côté client ou serveur (à choisir, mais PKCE obligatoire)
- Vérifier state (CSRF)
- Redirect URIs strict allowlist
- Linking:
  - Si email provider non vérifié => ne pas auto-link
  - Si user existe et email vérifié => linking autorisé avec règles
- Après OAuth:
  - si email non vérifié => forcer email verify (si possible) ou status pending_email
  - ensuite phone verify + MFA

Audit:
- OAUTH_START, OAUTH_CALLBACK_SUCCESS/FAIL, OAUTH_LINKED

---

## D) Cookies & sécurité session (strict)
- Cookies: HttpOnly, Secure, SameSite
- Access cookie: JWT, 15 min
- Refresh cookie: opaque, 30 jours, rotatif
- Clear cookies sur logout + password reset

---

## E) Captcha adaptatif
- Déclenchement sur signaux d’abus (échecs login, OTP spam)
- Vérifier captcha token côté backend (provider au choix)
- Ne pas exiger captcha en permanence (UX), mais enforce sur risque

---

## F) Critères d’acceptation (DoD Feature 01)
- Register -> email verify -> phone verify -> MFA setup -> active
- Login:
  - bloque si email/phone/MFA requis non complété
  - MFA challenge fonctionne
- Refresh rotation:
  - rotate ok
  - reuse detection => kill sessions + audit incident
- CSRF:
  - state-changing sans CSRF token => 403
  - Origin/Referer invalid => 403
- OAuth Google/GitHub:
  - PKCE + state
  - user created/linked correctement
  - onboarding derrière (phone + MFA)
- Audit logs présents pour toutes actions sensibles
- Rate limit + captcha adaptatif testés
- Documentation complète livrée

---

## G) Checklist sécurité (agent doit cocher)
- [ ] 1 Secure SDLC: docs + CI OK
- [ ] 2 Auth: Argon2id + MFA + anti brute force
- [ ] 3 Sessions: refresh rotation + reuse detection + revoke
- [ ] 4 RBAC: deny-by-default + contrôles objet
- [ ] 5 Validation inputs + uploads safe (si déjà)
- [ ] 6 Headers/CORS/CSP/HSTS OK
- [ ] 7 API security: rate limit, anti-enum, idempotency prêts
- [ ] 8 Chiffrement: secrets/tokens hashés, TOTP chiffré
- [ ] 9 Secrets: env validated, pas de secrets commit
- [ ] 10 Audit logs immuables présents
- [ ] 14 RGPD: suppression/export préparés (au moins data flags)
- [ ] 15 Tests: unit + integration + security