# THREAT_MODEL_AUTH

## Portée
- Auth classique (register/login)
- OAuth (Google/GitHub) — PKCE + state/nonce
- Email verify
- Phone verify (Twilio Verify)
- MFA TOTP + backup codes
- Sessions + refresh rotation + reuse detection

## Actifs
- Identifiants utilisateurs
- Tokens (access/refresh, email verify, reset)
- Secrets TOTP
- Sessions actives
- Données PII (email, phone)

## Menaces & mitigations (résumé)
### 1) Brute force / Credential stuffing
- Rate limit IP + compte
- Captcha adaptatif
- Erreurs neutres (anti-enum)

### 2) Token theft / session hijacking
- Cookies HttpOnly + Secure + SameSite
- Rotation refresh + détection de réutilisation
- Révocation serveur + logout global en incident

### 3) CSRF
- Origin/Referer strict
- Token CSRF (double-submit)

### 4) Session fixation
- Rotation de session après login/refresh
- Cookies invalidés sur logout/reset

### 5) OAuth attacks (CSRF, code injection)
- PKCE obligatoire
- `state`/`nonce` vérifiés
- Redirect URI allowlist stricte

### 6) Email/Phone verification abuse
- Rate limit + lockout
- Expiration tokens
- Tokens hashés en DB

### 7) MFA bypass / OTP replay
- TOTP secret chiffré
- Codes à usage unique (backup codes)
- Verrouillage après essais multiples

### 8) Injection (SQL/NoSQL/Command)
- ORM Prisma (requêtes paramétrées)
- Validation stricte des inputs

### 9) XSS
- CSP restrictive
- Pas d’inline scripts

### 10) Enumeration
- Messages d’erreur neutres
- Timing uniformisé (où possible)

### 11) SSRF
- Validation stricte des URLs (upload/exports)
- Allowlist pour callbacks (OAuth)

## Hypothèses
- TLS terminé au niveau Nginx (HTTP → HTTPS)
- Secrets fournis via env
