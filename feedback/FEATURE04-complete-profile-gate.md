# FEATURE04 - CompleteProfile blocked by onboarding gate

## Constat
Le flux “CompleteProfile” (apres OAuth ou login) utilise `PATCH /me`
pour enregistrer `first_name`, `last_name`, `username`, `nationality`.

Dans `apps/backend/src/middleware/onboardingGate.ts`, les routes autorisees
pendant l'onboarding n'incluent **pas** `PATCH /me`, donc la requete renvoie
`ONBOARDING_REQUIRED`.

## Impact
Le formulaire CompleteProfile ne peut pas finaliser le profil avant onboarding,
ce qui bloque l'accès a l'application.

## Proposition de patch backend
- Ajouter une regle autorisant `PATCH /me` dans `ALLOWED_RULES`, ou
- Créer un endpoint dedie `/me/complete` (allowed) qui appelle `completeOnboarding`.

## Tests a ajouter
- utilisateur sans onboarding peut PATCH /me (ou /me/complete) pour finaliser
- l'onboarding gate n bloque plus ce cas
