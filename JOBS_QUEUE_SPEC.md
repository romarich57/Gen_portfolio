# JOBS_QUEUE_SPEC

## Queue
- Queue DB-backed (table `jobs`)
- Types: GDPR_EXPORT, GDPR_PURGE
- Status: queued → running → succeeded|failed

## Payload
- GDPR_EXPORT: `{ exportId }`
- GDPR_PURGE: `{ userId, deletionRequestId }`

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
- Exécution par cron/worker externe en prod
