# Feature 03 — Profil Utilisateur (obligatoire) + RGPD (export async + suppression) + Avatars S3 (OVH) + Pre-signed URLs
Dépendances strictes: Feature 00 + Feature 01 + Feature 02 VALIDÉES.

## Objectif
Implémenter le module “Compte & Profil” en sécurité max, incluant :
- Profil utilisateur complet avec champs obligatoires (onboarding)
- Exception : si inscription via OAuth Google/GitHub, certains champs peuvent être absents => onboarding obligatoire après OAuth
- Avatar via OVH Object Storage S3-compatible (bucket privé) par pre-signed URLs
- RGPD :
  - Export des données via job queue (asynchrone) + ZIP en S3 (exports/ purge J+1)
  - Suppression de compte: soft delete immédiat + purge différée à J+7
- Consentements analytics/ads versionnés
- Audit logs immuables sur toutes actions sensibles
- CSRF strict (Origin/Referer + X-CSRF-Token) sur state-changing
- Validation stricte + anti-abus

Stack imposée:
- Node.js + Express + TypeScript strict
- Prisma + PostgreSQL
- OVH Object Storage S3-compatible (bucket privé)
- Pre-signed URLs courtes:
  - upload PUT 60–120s
  - download GET 120s
- Lifecycle S3:
  - exports/: purge J+1
  - imports/: purge J+30
  - avatars/old/: purge J+30

---

## A) Livrables attendus (obligatoires)

### A1) Docs (à la racine)
1) `PROFILE_SPEC.md`
- endpoints /me (GET/PATCH), règles de validation, erreurs neutres
- règles onboarding: champs obligatoires + exceptions OAuth
- règles “username illimité” (mais validation stricte)

2) `S3_OVH_SETUP.md`
- configuration OVH Object Storage (bucket privé)
- permissions minimales (least privilege)
- lifecycle rules exactes à appliquer (exports/imports/avatars old)
- variables d’env nécessaires

3) `AVATAR_UPLOAD_SECURITY.md`
- constraints (2MB, jpg/png/webp)
- interdiction SVG + prévention XSS
- stratégie object_key + purge anciens avatars
- politique cache-control

4) `GDPR_SPEC.md`
- export async (job queue), contenu exact, format ZIP
- suppression (soft delete + purge J+7)
- consentements versionnés
- audit requis

5) `JOBS_QUEUE_SPEC.md`
- choix de la queue (voir section questions à clarifier SI nécessaire)
- contrats job payload, retries, backoff, idempotency
- observabilité (status, erreurs)

### A2) Backend (code)
- Routes:
  - `/me` (GET, PATCH)
  - `/me/onboarding` (GET status, PATCH complete)
  - `/me/avatar/upload-url`
  - `/me/avatar/confirm`
  - `/me/gdpr/export/request`
  - `/me/gdpr/export/:id/status`
  - `/me/gdpr/export/:id/download-url`
  - `/me/gdpr/delete/request`
  - `/me/consents`
- Services:
  - ProfileService
  - OnboardingService (règles obligatoires + exception OAuth)
  - S3StorageService (OVH)
  - AvatarService (validation + versioning)
  - GdprExportService (crée job + construit ZIP)
  - GdprDeletionService (soft delete + purge J+7)
  - ConsentsService
  - JobsQueueService (enqueue + worker)
- Audit logs: obligatoire sur toutes actions sensibles

### A3) Tests (obligatoires)
- /me GET auth
- /me PATCH CSRF + validation stricte
- onboarding:
  - user password-based => onboarding requis jusqu’à completion
  - OAuth user => onboarding requis si champs manquants
- avatar:
  - upload-url ok
  - reject size>2MB / mime non autorisé / svg
  - confirm vérifie HEAD S3 + active + purge old
- gdpr export (async):
  - request crée job + status queued
  - worker produit ZIP en S3 + status ready
  - download-url TTL 120s
  - rate-limit export
- delete:
  - step-up requis
  - soft delete + revoke sessions immédiat
  - purge planifiée J+7
- sécurité:
  - erreurs neutres
  - rate limit endpoints sensibles

---

## B) Modèle de données (Prisma) — strict

### B1) Choix imposé
- Stocker le profil dans `users` (simple V1) + tables dédiées pour files/exports/consents/deletion.
- Ajouter un champ `onboarding_completed_at` dans `users`.

### B2) Champs users requis
- first_name (nullable)
- last_name (nullable)
- username (unique, nullable)
- nationality (nullable)
- avatar_file_id (nullable FK files)
- onboarding_completed_at (nullable)
- deleted_at (RGPD)
- created_at, updated_at

Règle onboarding:
- Pour un compte non-OAuth (register classique), `first_name`, `last_name`, `username`, `nationality` doivent être fournis avant `onboarding_completed_at`.
- Pour un compte OAuth (Google/GitHub), ils peuvent être null à la création, mais l’accès aux features produit (hors /me & /billing/status) doit être bloqué tant que onboarding non complété.

### B3) Tables obligatoires
1) `files`
- id (uuid)
- owner_user_id (FK users)
- kind: "avatar" | "gdpr_export" | "import" | "other"
- bucket
- object_key (unique)
- mime_type
- size_bytes
- checksum_sha256 (nullable, recommandé)
- status: "pending" | "active" | "deleted"
- created_at, updated_at, deleted_at

2) `gdpr_exports`
- id
- user_id (FK users)
- file_id (FK files, nullable tant que pas ready)
- status: "queued" | "building" | "ready" | "failed" | "expired"
- requested_at
- ready_at
- expires_at (<= 24h max)
- error_message (nullable)

3) `consents`
- id
- user_id (FK users)
- analytics_enabled (bool)
- ads_enabled (bool)
- consent_version (string, ex "v1")
- consented_at (timestamp)
- source ("signup"|"settings"|"banner")
- ip_hash (optionnel)
- user_agent_hash (optionnel)

4) `deletion_requests`
- id
- user_id
- status: "requested" | "scheduled" | "completed" | "failed"
- requested_at
- scheduled_for (requested_at + 7 days)
- completed_at
- error_message

5) `jobs`
- id
- type: "GDPR_EXPORT" | "GDPR_PURGE" | etc.
- payload_json (minimisé)
- status: "queued" | "running" | "succeeded" | "failed"
- attempts
- run_after
- locked_at, locked_by
- last_error
- created_at, updated_at

NOTE:
- L’agent doit implémenter un worker “DB-backed” minimal OU brancher une queue existante, mais ne doit rien inventer non documenté.
- Idempotency: un export actif par user (ex: empêcher 10 exports) => stratégie définie dans JOBS_QUEUE_SPEC.md.

---

## C) Règles sécurité non négociables

### C1) Auth/CSRF
- Toutes routes state-changing (/me PATCH, onboarding PATCH, avatar POST, gdpr POST, consents POST) exigent :
  - cookies auth
  - Origin/Referer strict
  - X-CSRF-Token valide
- GET download-url: auth obligatoire, no CSRF (GET), audit log.

### C2) Step-up auth (MFA récent)
- GDPR export request: step-up obligatoire
- GDPR delete request: step-up obligatoire
- Changement email (si présent): step-up obligatoire

### C3) Onboarding gate (obligatoire)
Implémenter un middleware de “gate”:
- Si user.deleted_at != null => bloque (403)
- Si onboarding_completed_at == null => autoriser UNIQUEMENT:
  - GET /me
  - PATCH /me/onboarding
  - billing/status (lecture)
  - logout
  - endpoints nécessaires MFA si besoin
Sinon: 403 code "ONBOARDING_REQUIRED"
Audit: ONBOARDING_BLOCKED (optionnel mais recommandé)

### C4) Avatar upload (S3 privé)
- Formats autorisés: jpeg/png/webp
- Taille max: 2MB
- Interdiction SVG
- object_key = `avatars/{userId}/{uuid}` (jamais from user)
- upload via pre-signed PUT (60–120s)
- confirm via HEAD S3 (existence + taille + content-type)
- versioning:
  - ancien avatar => status deleted + (option) move vers avatars/old/
- purge old via lifecycle avatars/old J+30
- Audit:
  - AVATAR_UPLOAD_URL_ISSUED
  - AVATAR_SET_ACTIVE

### C5) RGPD export async
- POST request => crée gdpr_exports(status queued) + crée job GDPR_EXPORT
- Worker:
  - rassemble données (minimisation)
  - construit ZIP (json + README)
  - upload S3 `exports/{userId}/{exportId}.zip`
  - crée files(kind=gdpr_export, active)
  - update gdpr_exports status ready + expires_at now+24h
- Download-url TTL 120s + audit
- Rate limit export: 2/jour/user
- Anti-abus: captcha adaptatif si burst

### C6) Suppression compte
- POST delete request => step-up + soft delete immédiat (deleted_at) + revoke sessions + schedule job purge J+7
- Job GDPR_PURGE:
  - supprime/anonimise PII requise (selon politique)
  - supprime fichiers S3 liés (avatars/export) si applicable
  - marque deletion_requests completed
- Audit:
  - GDPR_DELETION_REQUESTED
  - GDPR_DELETION_COMPLETED

---

## D) Endpoints (Express) — strict

### D1) GET /me
Auth: oui
Retour:
- id, email, first_name, last_name, username, nationality, avatar_url (signed courte), roles, onboarding_completed_at

### D2) PATCH /me/onboarding
Auth: oui
CSRF: oui
Input:
- first_name, last_name, username, nationality
Rules:
- validation stricte
- username unique
- set onboarding_completed_at = now si tous champs présents
Audit: ONBOARDING_COMPLETED

### D3) PATCH /me
Auth: oui
CSRF: oui
Champs modifiables:
- first_name, last_name, username, nationality, locale
Règles:
- username modifiable illimité MAIS validation stricte + unique
Audit: PROFILE_UPDATED

### D4) POST /me/avatar/upload-url
Auth: oui
CSRF: oui
Rate limit: 5/min/user
Input: mime_type, size_bytes
Retour: upload_url (PUT), file_id
Audit: AVATAR_UPLOAD_URL_ISSUED

### D5) POST /me/avatar/confirm
Auth: oui
CSRF: oui
Input: file_id
Process: HEAD S3 + activation + désactivation ancien
Audit: AVATAR_SET_ACTIVE

### D6) POST /me/gdpr/export/request
Auth: oui
CSRF: oui
Step-up: oui
Rate limit: 2/jour/user
Retour: export_id, status=queued
Audit: GDPR_EXPORT_REQUESTED

### D7) GET /me/gdpr/export/:id/status
Auth: oui
Retour: status + error_message safe
Audit: optionnel

### D8) GET /me/gdpr/export/:id/download-url
Auth: oui
Retour: signed GET URL TTL=120s
Audit: GDPR_EXPORT_DOWNLOAD_URL_ISSUED

### D9) POST /me/gdpr/delete/request
Auth: oui
CSRF: oui
Step-up: oui
Retour: status requested/scheduled
Audit: GDPR_DELETION_REQUESTED

### D10) POST /me/consents
Auth: oui
CSRF: oui
Input: analytics_enabled, ads_enabled, consent_version, source
Audit: CONSENTS_UPDATED

---

## E) Critères d’acceptation (DoD Feature 03)
- Onboarding obligatoire: register classique => bloqué tant que champs requis pas fournis
- OAuth: user peut exister sans profil complet, mais onboarding requis avant accès produit
- Username unique, modifiable illimité
- Avatar upload sécurisé via S3 presigned + confirm HEAD
- GDPR export async: request => job => ready => download-url TTL 120s
- Suppression: soft delete + revoke sessions immédiat + purge J+7 via job
- Docs + tests livrés, lint/test OK

---

## F) Checklist sécurité (agent doit cocher)
- [ ] 4 RBAC/ABAC : owner-only sur /me et resources
- [ ] 5 Validation inputs + upload hardening (no svg, size<=2MB, allowlist mime)
- [ ] 6 CSRF/Origin/Referer sur state-changing
- [ ] 7 API security: rate limits + anti-abus export
- [ ] 8 Minimisation + rétention + purge (S3 lifecycle + J+7 purge)
- [ ] 10 Audit logs sur actions sensibles
- [ ] 14 RGPD (export + suppression + consentements)
- [ ] 15 Tests (unit + integration + security)