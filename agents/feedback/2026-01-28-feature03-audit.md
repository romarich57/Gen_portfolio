# 2026-01-28 Feature03 Audit

Omissions found and fixed:

1) Missing test: OAuth onboarding gate
- Impact: onboarding gate behavior for OAuth users not explicitly covered.
- Fix: added test in `apps/backend/tests/security/onboardingGate.test.ts`.

2) Missing test: GET /me auth
- Impact: auth requirement for profile read not explicitly covered.
- Fix: added test in `apps/backend/tests/integration/meProfile.test.ts`.

3) Missing audit log: GDPR export completion
- Impact: export generation not logged as a sensitive action.
- Fix: add `GDPR_EXPORT_READY` audit log in `apps/backend/src/services/gdprExport.ts` after export is ready.

4) MinIO dev doc env values
- Impact: DEV guidance used HTTPS/SSL for MinIO; could break local testing.
- Fix: updated `S3_STORAGE_SETUP.md` to use `http://localhost:9000` and `S3_USE_SSL=false`.

5) Duplicate import in avatar service
- Impact: minor code hygiene (potential lint issues).
- Fix: removed duplicate `env` import in `apps/backend/src/services/avatar.ts`.

6) Jobs retry/backoff added
- Impact: resiliency for GDPR export/purge jobs.
- Fix: implement max 3 attempts with exponential backoff in `apps/backend/src/services/jobs.ts` and document in `JOBS_QUEUE_SPEC.md`.
