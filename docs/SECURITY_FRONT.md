# SECURITY_FRONT

## Regles non negociables
- Aucun token stocke dans localStorage/sessionStorage.
- Cookies HttpOnly uniquement pour session.
- CSRF token en memoire (GET /auth/csrf) et header `X-CSRF-Token` sur POST/PATCH/DELETE.
- `fetch` avec `credentials: "include"` partout.
- Pas de log de donnees sensibles (OTP, tokens, secrets, PII inutile).
- Captcha adaptatif supporte (affiche si `CAPTCHA_REQUIRED`).
- Flag frontend: `VITE_CAPTCHA_ENABLED=false` (placeholder si non configure).
- Login accepte email OU pseudo dans le meme champ.
- Actions sensibles depuis Profil > Securite:
  - Regeneration des backup codes (MFA recent requis).
  - Gestion des sessions (revoquer une session ou tout).
  - Alertes de securite (email/SMS).
  - Email de recuperation (verification obligatoire).
  - Suppression compte (GDPR delete + MFA recent).

## Gestion des erreurs
- Messages neutres (anti-enumeration).
- Ne pas exposer d'etat interne ou d'IDs sensibles.
- Mapper les erreurs MFA_STEP_UP_REQUIRED / PHONE_NOT_VERIFIED / PASSWORD_REQUIRED vers des messages clairs.

## XSS / UI
- Pas de `dangerouslySetInnerHTML`.
- Echapper ou normaliser les champs utilisateurs.

## HTTPS dev obligatoire
- Front: https://localhost:3000
- API: https://localhost:4000
- Nginx + certificat auto-signe (voir README_DEV_HTTPS.md)
