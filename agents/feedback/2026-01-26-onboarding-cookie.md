# 2026-01-26 — Onboarding token pour étapes phone/MFA

- Date: 2026-01-26
- Contexte: Login doit bloquer si email/phone/MFA manquants, tout en permettant l’onboarding sécurisé.
- Problème: Les endpoints phone/MFA nécessitent un identifiant user sans session complète.
- Impact sécurité (piliers): 2 (auth), 3 (sessions), 7 (API security), 10 (audit).
- Décision / Fix: Utiliser un cookie HttpOnly `onboarding_token` (JWT court) après email verification ou login partiel pour autoriser uniquement `/auth/phone/*` et `/auth/mfa/*`.
- Validation (tests / preuve): Tests d’onboarding dans `apps/backend/tests/integration/authFlow.test.ts`.
