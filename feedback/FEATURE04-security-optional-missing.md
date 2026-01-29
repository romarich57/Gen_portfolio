# FEATURE04 - Security optional flows missing (backend)

## Constat
Le frontend expose dans Profil > Securite :
- Ajouter un telephone (Twilio Verify)
- Activer MFA TOTP

Les endpoints actuels sont :
- `POST /auth/phone/start` et `POST /auth/phone/check`
- `POST /auth/mfa/setup/start` et `POST /auth/mfa/setup/confirm`

Ces routes exigent le cookie d'onboarding (`onboarding` / `mfa`) et retournent
`ONBOARDING_REQUIRED` si l'utilisateur est deja actif.

## Impact
Les actions “optionnelles” dans Profil > Securite ne peuvent pas fonctionner
pour un utilisateur actif.

## Proposition de patch backend
1. Ajouter des endpoints dedies, ex:
   - `POST /me/security/phone/start`
   - `POST /me/security/phone/check`
   - `POST /me/security/mfa/setup/start`
   - `POST /me/security/mfa/setup/confirm`
2. Ou assouplir les routes existantes pour accepter un utilisateur `active`
   (en remplacant l'onboarding cookie par un check `requireAuth`).
3. Ajouter audit logs: `SECURITY_PHONE_SETUP_STARTED`, `SECURITY_MFA_SETUP_STARTED`.

## Tests a ajouter
- utilisateur actif peut lancer verification telephone
- utilisateur actif peut activer MFA
