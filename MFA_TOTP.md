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

## MFA obligatoire
- Global via `feature_flags.mfa_required_global`
- Override user via `users.mfa_required_override` (respecte `feature_flags.allow_disable_mfa`)
- Admin endpoints: `PUT /admin/security/mfa-flags`, `PATCH /admin/users/:id/mfa-override`
