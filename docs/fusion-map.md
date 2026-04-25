# Fusion Map

## Conserver tel quel

- Auth, MFA, sessions, refresh token, CSRF, RBAC, audit logs.
- Profil utilisateur et endpoints `/api/me/*`.
- Billing Stripe et admin API.
- Layouts principaux et composants UI.

## Fusionner

- Entitlements billing avec quotas CV/IA/export.
- Profil utilisateur comme source optionnelle de pre-remplissage CV.
- React Query comme source de verite frontend pour CV.
- Admin avec futur endpoint `/api/admin/resumes` masquant le contenu par defaut.

## Deplacer ou reimplementer

- Types CV et templates `magic-resume` vers un domaine CV propre.
- Import/export dans services backend et jobs internes.
- IA polish/grammar/import cote serveur, pas dans le navigateur.

## Supprimer

- Ancienne landing/pricing projet.
- Configuration IA client.
- Provider/model/API key visibles dans l'UI.
- Persistance CV locale comme source officielle.

## Backend cible ajoute

- `apps/backend/src/modules/resumes`.
- `apps/backend/src/modules/ai`.
- Routes `/api/resumes/*` et `/api/ai/resume/*`.
- Modeles Prisma Resume, ResumeVersion, ResumeAsset, ResumeExport, ResumeImport, AiUsageEvent.

## Frontend cible ajoute

- `/`: presentation CV Genius.
- `/pricing`: pricing CV.
- `/dashboard`: liste et actions CV.
- `/builder`: creation/import.
- `/generation`: alias generation IA.
- `/editor/:resumeId`: edition manuelle.
- `/templates`: galerie.

## Ownership

Tout acces CV backend filtre par `id` et `ownerUserId = req.user.id`. Les routes retournent 404 pour un objet inexistant ou appartenant a un autre utilisateur.
