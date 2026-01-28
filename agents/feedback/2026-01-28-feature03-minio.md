# 2026-01-28 Feature03 MinIO

RESOLU: pinned MinIO image digests (minio/minio and minio/mc).
- Impact traité: environnement dev déterministe + réduction risque supply-chain.
- Implémentation: `docker-compose.yml` utilise `minio/minio@sha256:...` et `minio/mc@sha256:...`.

Decision (documented): MinIO integrated into existing `docker-compose.yml`, bucket `app-dev` auto-created by `minio-init`, dev creds `minioadmin`/`minioadmin`.
