# Integration Plan

## Ordre applique

1. Auditer le repo principal et `magic-resume`.
2. Identifier les traces SaaS Builder visibles.
3. Ajouter schema Prisma CV/IA et migration.
4. Ajouter config env IA Gemini.
5. Ajouter module backend `resumes`.
6. Ajouter module backend `ai`.
7. Monter `/api/resumes` et `/api/ai`.
8. Ajouter tests CRUD/ownership/CSRF et IA stricte.
9. Ajouter i18n frontend `fr/en`.
10. Ajouter pages CV Genius.
11. Adapter dashboard, pricing, layouts et branding.
12. Supprimer la page publique projet obsoleted.
13. Documenter securite, IA, i18n, validation.

## Fichiers principaux crees

- `apps/backend/src/modules/resumes/**`
- `apps/backend/src/modules/ai/**`
- `apps/backend/prisma/migrations/20260424120000_cv_genius_resumes/migration.sql`
- `apps/frontend/src/api/resumes.ts`
- `apps/frontend/src/api/ai.ts`
- `apps/frontend/src/i18n/**`
- `apps/frontend/src/pages/public/ResumeLanding.tsx`
- `apps/frontend/src/pages/public/ResumePricing.tsx`
- `apps/frontend/src/pages/private/ResumeBuilder.tsx`
- `apps/frontend/src/pages/private/ResumeEditor.tsx`
- `apps/frontend/src/pages/private/Templates.tsx`

## Tests prevus

- Backend: CRUD CV, ownership cross-user, CSRF, IA schema stricte.
- Frontend: dashboard CV, auth/profile/billing non-regression.
- Anti-branding: grep des sources actives.

## Risques

- Validation backend complete bloquee par credentials PostgreSQL locaux invalides.
- Export PDF async et assets S3 sont implementes sur la surface API de base, mais pas encore couverts par un test end-to-end complet.
- Admin CV dedie `/api/admin/resumes` reste a finaliser au-dela du socle.
