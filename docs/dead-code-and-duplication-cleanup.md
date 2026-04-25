# Dead Code And Duplication Cleanup

## Supprime

- `apps/frontend/src/pages/public/LandingPricing.tsx`: ancienne page projet/brief/specs non routee et incompatible CV Genius.

## Renomme/adapte

- Branding backend/frontend/admin vers CV Genius.
- Package names backend/frontend/admin.
- JWT issuer et MFA issuer.
- Emails de securite.
- Navigation publique/privee.

## Conserve temporairement

- Migrations historiques.
- Champs billing legacy `projectLimit/projectsUsed`.
- Docs historiques liees au socle, a migrer dans une passe documentaire separee.

## Duplications evitees

- Les clients API CV/IA utilisent le client HTTP existant.
- Les routes CV/IA reutilisent middlewares auth/CSRF/RBAC/rate-limit existants.
- React Query reste source de verite pour les donnees serveur.

## A poursuivre

- Decouper les anciens fichiers longs hors scope CV direct.
- Integrer les vrais templates `magic-resume` dans un module partage plutot que dupliquer les layouts.
- Remplacer les derniers textes hardcodes historiques par i18n.
- Nettoyer les traces generees par Playwright (`test-results`) selon la politique de repo si elles ne sont pas ignorees.
