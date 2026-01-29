# MFA_TOTP

## Setup
1) `POST /auth/mfa/setup/start` -> `otpauthUrl`
2) Scanner QR dans l’app TOTP
3) `POST /auth/mfa/setup/confirm` avec code TOTP

## Stockage
- Secret TOTP chiffré (AES‑256‑GCM)
- Backup codes hashés (one‑time)

## Vérification
- `POST /auth/mfa/verify` accepte TOTP ou backup code
- Mise à jour `last_used_at`

## Politique MFA (admin)
- `feature_flags.mfa_required_global=true` impose la configuration MFA avant accès complet.
- `users.mfa_required_override` peut forcer/relâcher la règle au niveau user.
- Tant que `mfa_enabled=false` et MFA requise:
  - `/auth/login` et `/auth/refresh` renvoient `MFA_SETUP_REQUIRED`.
  - L’accès applicatif est bloqué (gate backend + redirection UI).
