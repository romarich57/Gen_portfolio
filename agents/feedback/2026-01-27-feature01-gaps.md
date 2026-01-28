# 2026-01-27 — Feature 01 Gaps (à corriger)

## Ommissions identifiées
1) **Tests onboarding accès protégé** manquants (users `pending_email|pending_phone|pending_mfa`).
2) **Admin MFA flags** (global + per user) non exposés via endpoints sécurisés + audit.
3) **Lockout OTP** non implémenté (`phone_verifications.attempts` non exploité).
4) **Rate‑limit par compte** manquant (login = IP+compte).
5) **Audit reason code** sur `LOGIN_FAIL` manquant.
6) **Audit RESET_REQUESTED** pour email inconnu manquant.
7) **AppSetting `otp_rate_limits`** non appliqué.
8) **OAuth nonce** (state/nonce) non géré.

## Décision
Corriger l’ensemble des points ci‑dessus avant validation finale Feature 01.
