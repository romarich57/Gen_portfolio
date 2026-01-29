# FEATURE04 - Register profile fields missing (backend)

## Constat
Le frontend envoie un payload complet sur `POST /auth/register` :
`{ email, password, firstName, lastName, username, nationality }`.

Dans le backend actuel (`apps/backend/src/routes/auth.ts`), le schéma `registerSchema`
n'accepte que `{ email, password }` et renvoie `VALIDATION_ERROR` pour les autres champs.

## Impact
- Le formulaire Register complet ne peut pas fonctionner.
- L'onboarding/complete profile ne peut pas être validé côté backend au moment de la création.

## Proposition de patch backend
1. Étendre `registerSchema` pour accepter :
   - `firstName`, `lastName` (min 2)
   - `username` (3-30, `[a-zA-Z0-9._-]`)
   - `nationality` (ISO2)
2. Stocker ces champs lors de la création user :
   - `firstName`, `lastName`, `username`, `nationality`
3. Si tous les champs sont présents :
   - `onboardingCompletedAt = now`
   - `status` reste `pending_email` (email verification required)
4. Ajouter audit log `REGISTER_PROFILE_CAPTURED`.

## Tests à ajouter
- register accepte payload complet (201)
- register rejette username invalide
- register rejette nationality invalide
