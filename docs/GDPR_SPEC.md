# GDPR_SPEC

## Export async
- POST /me/gdpr/export/request
  - Auth + CSRF + step‑up MFA (MFA vérifiée récemment, max = reauthMaxHours)
  - Rate limit: 2/jour/user
  - Crée `gdpr_exports` (status=queued) + job GDPR_EXPORT
- Worker GDPR_EXPORT
  - Rassemble données minimisées
  - ZIP: `data.json` + `README.txt`
  - Upload S3 `exports/{userId}/{exportId}.zip`
  - Crée `files` kind=gdpr_export
  - `gdpr_exports`: status=ready, expires_at=now+24h
- GET /me/gdpr/export/:id/status
- GET /me/gdpr/export/:id/download-url
  - Signed GET TTL 120s (env `S3_PRESIGN_GET_TTL_SECONDS`)
  - Audit: GDPR_EXPORT_DOWNLOAD_URL_ISSUED

## Suppression compte
- POST /me/gdpr/delete/request
  - Auth + CSRF + step‑up MFA (MFA vérifiée récemment, max = reauthMaxHours)
  - Soft delete immédiat (`users.deleted_at`)
  - Révocation sessions
  - Crée `deletion_requests` status=scheduled
  - Job GDPR_PURGE planifié J+7

## Purge J+7 (job)
- Suppression/anon de PII (email, username, noms, etc.)
- Suppression fichiers S3 (avatars/exports)
- `deletion_requests` => completed

## Consentements versionnés
- POST /me/consents
  - analytics_enabled, ads_enabled, consent_version, source
  - ip_hash + user_agent_hash (optionnels)

## Audits
- GDPR_EXPORT_REQUESTED
- GDPR_EXPORT_DOWNLOAD_URL_ISSUED
- GDPR_DELETION_REQUESTED
- GDPR_DELETION_COMPLETED (au job)
