# Main Repo Audit - CV Genius

## Scope

Repo principal audite le 2026-04-24 avant integration CV Genius.

## Architecture constatee

- Backend: `apps/backend`, Node.js, Express, TypeScript strict, Prisma, PostgreSQL.
- Frontend user: `apps/frontend`, React, TypeScript, Vite, React Router, React Query.
- Admin: `frontends_admin`, React separe, API dediee `/api/admin/*`.
- Auth: cookies HttpOnly, access JWT court, refresh opaque hashe en DB, rotation/revocation.
- Securite: middlewares CORS, CSRF, rate limit, RBAC, MFA TOTP, audit logs, headers.
- Billing: Stripe via webhooks signes et idempotents.
- Storage: S3-compatible via fichiers et URL pre-signees.

## Modules backend utiles a conserver

- `auth`: source de verite login/register/refresh/logout/OAuth/MFA.
- `me`: profil, preferences, sessions, RGPD.
- `billing`: plans Stripe, entitlements, quotas.
- `admin`: back-office avec masquage des donnees sensibles.
- `middleware`: auth, CSRF, RBAC, rate limits, logging, security headers.
- `services`: MFA, emails, security alerts, jobs, storage.

## Modules frontend utiles a conserver

- `AuthBootstrap`, `ProtectedRoute`, layouts public/prive.
- Pages auth, MFA, profil, sessions, billing.
- Client HTTP central avec `credentials: include` et CSRF.
- Composants UI reutilisables.

## Fragilites identifiees

- Plusieurs documents historiques et noms internes restaient orientes SaaS/portfolio.
- Le pricing et le dashboard etaient orientes projet, pas CV.
- L'i18n n'etait pas structuree par namespaces.
- Les entitlements ne distinguaient pas encore CV, IA et exports.
- La validation complete depend d'une base PostgreSQL de test locale dont les credentials etaient invalides pendant cette iteration.

## Decisions

- Garder l'architecture multi-app existante.
- Ajouter les domaines CV/IA comme modules backend dedies.
- Recentrer les routes publiques et privees du frontend sur CV Genius.
- Conserver temporairement les champs billing legacy pour compatibilite de migration.
