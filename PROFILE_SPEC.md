# PROFILE_SPEC

## Endpoints

### GET /me
Auth: cookie HttpOnly
Returns:
- id, email
- first_name, last_name, username, nationality, locale
- roles
- avatar_url (signed GET, short TTL)
- onboarding_completed_at

### PATCH /me/onboarding
Auth: yes
CSRF: yes
Input (required):
- first_name (1–64)
- last_name (1–64)
- username (regex `^[a-zA-Z0-9_]{3,30}$`)
- nationality (ISO2, uppercase)
Rules:
- username unique
- sets `onboarding_completed_at` when complete
Errors: VALIDATION_ERROR, USERNAME_TAKEN
Audit: ONBOARDING_COMPLETED

### GET /me/onboarding
Auth: yes
Returns:
- completed (bool)
- missing_fields[]
- onboarding_completed_at

### PATCH /me
Auth: yes
CSRF: yes
Input (optional):
- first_name, last_name, username, nationality, locale
Rules:
- username modifiable unlimited times, validated + unique
Errors: VALIDATION_ERROR, USERNAME_TAKEN
Audit: PROFILE_UPDATED

### POST /me/consents
Auth: yes
CSRF: yes
Input:
- analytics_enabled (bool)
- ads_enabled (bool)
- consent_version (ex: "v1")
- source (signup|settings|banner)
Audit: CONSENTS_UPDATED

## Onboarding rules
- Comptes non‑OAuth: champs profil requis pour activer `onboarding_completed_at`.
- Comptes OAuth: champs peuvent être vides à la création, mais accès produit bloqué tant que `onboarding_completed_at` est null.

## Username
- Changements illimités
- Validation stricte (regex ci‑dessus)
- Unicité DB

## Erreurs neutres
- Pas de fuite d’existence d’utilisateur.
