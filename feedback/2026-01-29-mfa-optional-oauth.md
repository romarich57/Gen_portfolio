c# 2026-01-29 — MFA opt-in only (OAuth/Login)

## MANQUANT / Changement demandé
Le besoin produit indique que la MFA ne doit apparaître **que si l’utilisateur l’active**, y compris après OAuth,
et que le passage “compléter le profil” ne doit pas être bloqué par une MFA imposée.

## Impact
- Les flags admin `feature_flags.mfa_required_global` / `users.mfa_required_override` ne forcent plus l’auth.
- Les parcours OAuth/login ne déclenchent la MFA que si `mfa_enabled=true`.

## Correctif appliqué
- Suppression du blocage `MFA_SETUP_REQUIRED` dans `/auth/login` et `/auth/oauth/:provider/callback`.
- MFA challenge uniquement si `mfa_enabled=true` (et profil complet côté OAuth).
- Documentation mise à jour (AUTH_SPEC, API_CONTRACT_UI, MFA_TOTP).

## Vérification
- OAuth: redirige vers `/oauth/callback?next=complete-profile` sans MFA.
- Login email/username: MFA uniquement si activée.
