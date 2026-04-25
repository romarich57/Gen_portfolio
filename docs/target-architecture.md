# Target Architecture - CV Genius

## Frontend

- `app shell`: layouts public/prive existants.
- `auth/mfa/profile/billing`: modules conserves.
- `resumes`: pages dashboard, builder, generation, editor, templates.
- `api`: clients `resumes.ts` et `ai.ts`.
- `i18n`: i18next avec `fr` par defaut et `en` fallback.
- `state`: React Query pour donnees serveur; etat local uniquement pour drafts UI non sensibles.

## Backend

- `auth`, `mfa`, `users`, `profiles`: source de verite existante.
- `resumes`: CRUD, duplicate, versions, assets, imports, exports.
- `ai`: abstraction provider, generation/import/polish/grammar, usage.
- `security`: auth, CSRF, RBAC, rate limit, sanitation, audit.
- `jobs`: types `RESUME_EXPORT`, `RESUME_IMPORT_PARSE`, `RESUME_PURGE_ASSETS`.

## Contrats de donnees

- `Resume`: `ownerUserId`, `title`, `status`, `templateId`, `content`, `version`.
- `ResumeVersion`: historique par resume et auteur.
- `ResumeAsset`: references S3 privees.
- `ResumeExport`: exports JSON/Markdown immediats et PDF async.
- `ResumeImport`: suivi des imports texte/fichier.
- `AiUsageEvent`: operation, provider, modele serveur, statut, credits, latence.

## IA

- Provider choisi par l'application via `AI_PROVIDER=gemini`.
- Clef Gemini uniquement en env backend.
- Sortie validee par Zod avant persistance.
- Fallback mock en test/developpement sans clef.

## Securite

- Deny-by-default via `requireAuth`.
- CSRF sur routes state-changing.
- Rate limits dedies CV/IA.
- Sanitation HTML serveur avant stockage.
- Logs rediges pour prompt, texte, resume, content, model/provider/apiKey.
