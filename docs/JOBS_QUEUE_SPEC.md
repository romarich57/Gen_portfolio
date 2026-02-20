# JOBS_QUEUE_SPEC

## Queue
- Queue DB-backed (table `jobs`)
- Types: GDPR_EXPORT, GDPR_PURGE, ZIP_EXPORT, GITHUB_DEPLOY
- Status: queued → running → succeeded|failed

## Payload
- GDPR_EXPORT: `{ exportId }`
- GDPR_PURGE: `{ userId, deletionRequestId }`
- ZIP_EXPORT: `{ portfolioId, userId }` (Compilation des bundles React côté serveur ou via worker)
- GITHUB_DEPLOY: `{ portfolioId, userId, githubRepoName }` (Déploiement direct via Octokit)

## Idempotency
- Un export actif par user: si un export queued/building/ready non expiré existe, on le réutilise.
- Job runner ignore si export déjà ready/completed.

## Scheduling
- `run_after` permet d’exécuter à une date future (purge J+7)

## Attempts / erreurs
- `attempts` incrémenté à la prise de job
- `last_error` stocke l’erreur
- Retry automatique (max 3 tentatives) avec backoff exponentiel:
  - base 5 min, max 60 min
  - statut repasse `queued` + `run_after` recalculé
  - échec définitif => status `failed` + erreurs propagées aux entités (gdpr_export / deletion_request)

## Worker
- Fonction `runNextJob()` exécute un job due
- Worker dédié: `src/worker.ts` (boucle continue + arrêt propre SIGINT/SIGTERM)
- Scripts:
  - `npm --prefix apps/backend run worker:dev`
  - `npm --prefix apps/backend run worker`
  - `npm --prefix apps/backend run worker:once`
- Déploiement:
  - `docker-compose.dev.yml`: service `backend_worker`
  - `docker-compose.prod.yml`: service `backend_worker`

## Monitoring file de jobs
- Le service status inclut un check queue health:
  - `queued` en retard (run_after dépassé depuis >5 min)
  - `running` potentiellement bloqués (`locked_at` nul ou trop ancien >15 min)
- Ces signaux sont exposés dans `/admin/status/services` et `/admin/status/services/history`.
