# S3_STORAGE_SETUP

## DEV (MinIO)

### Docker-compose (choix)
- MinIO est intégré au `docker-compose.yml` existant.

### Démarrer
```bash
docker compose up -d
```

### Console
- URL: https://localhost:9001
- Identifiants (DEV uniquement):
  - MINIO_ROOT_USER=minioadmin
  - MINIO_ROOT_PASSWORD=minioadmin

### Bucket
- Bucket dev: `app-dev`
- Création automatique via service `minio-init` (mc) dans compose.
- Policy: private (aucun public)
- Lifecycle rules: non requis en dev (purge simulée par jobs/cron si besoin)

### Env DEV (backend)
```
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=app-dev
S3_FORCE_PATH_STYLE=true
S3_USE_SSL=false
S3_PRESIGN_PUT_TTL_SECONDS=120
S3_PRESIGN_GET_TTL_SECONDS=120
```

### Smoke test (avatar upload)
Prereqs: backend running on http://localhost:4000 and `jq` installed.

1) Create a dev user + access token (onboarding completed):
```bash
ACCESS_TOKEN=$(npx tsx -e "import { config } from 'dotenv'; config({ path: 'apps/backend/.env' }); import { prisma } from './apps/backend/src/db/prisma'; import { signAccessToken } from './apps/backend/src/utils/jwt'; (async()=>{ const suffix=Date.now(); const email='minio-' + suffix + '@example.com'; const username='minio' + suffix; const user=await prisma.user.create({ data: { email, status: 'active', roles: ['user'], firstName: 'Minio', lastName: 'User', username, nationality: 'FR', onboardingCompletedAt: new Date() } }); console.log(signAccessToken({ sub: user.id, roles: ['user'] }, 15)); await prisma.$disconnect(); })();")
```

2) Get a CSRF token (store cookie):
```bash
CSRF_TOKEN=$(curl -s -c /tmp/csrf.txt -H "Origin: http://localhost:3000" http://localhost:4000/auth/csrf | jq -r .csrfToken)
```

3) Request avatar upload URL:
```bash
UPLOAD_JSON=$(curl -s -b /tmp/csrf.txt -b "access_token=${ACCESS_TOKEN}" \
  -H "Origin: http://localhost:3000" \
  -H "X-CSRF-Token: ${CSRF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"mime_type":"image/png","size_bytes":12345}' \
  http://localhost:4000/me/avatar/upload-url)
UPLOAD_URL=$(echo "$UPLOAD_JSON" | jq -r .upload_url)
FILE_ID=$(echo "$UPLOAD_JSON" | jq -r .file_id)
```

4) Upload the file to MinIO (<=2MB, jpg/png/webp only):
```bash
curl -s -X PUT -H "Content-Type: image/png" --data-binary @/path/to/avatar.png "$UPLOAD_URL"
```

5) Confirm avatar:
```bash
curl -s -b /tmp/csrf.txt -b "access_token=${ACCESS_TOKEN}" \
  -H "Origin: http://localhost:3000" \
  -H "X-CSRF-Token: ${CSRF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"file_id\":\"${FILE_ID}\"}" \
  http://localhost:4000/me/avatar/confirm
```

### Optional: GDPR export smoke (requires recent MFA)
- If you already have a recent MFA step-up, request an export and run the worker:
```bash
EXPORT_JSON=$(curl -s -b /tmp/csrf.txt -b "access_token=${ACCESS_TOKEN}" \
  -H "Origin: http://localhost:3000" \
  -H "X-CSRF-Token: ${CSRF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4000/me/gdpr/export/request)
EXPORT_ID=$(echo "$EXPORT_JSON" | jq -r .export_id)
npx tsx -e "import { prisma } from './apps/backend/src/db/prisma'; import { runNextJob } from './apps/backend/src/services/jobs'; (async()=>{ await runNextJob('dev'); await prisma.$disconnect(); })();"
curl -s -b "access_token=${ACCESS_TOKEN}" http://localhost:4000/me/gdpr/export/${EXPORT_ID}/download-url
```

## PROD (OVH Object Storage)

### Configuration
- Bucket privé obligatoire
- Lifecycle rules:
  - exports/: purge J+1
  - imports/: purge J+30
  - avatars/old/: purge J+30

### Permissions minimales
- s3:PutObject, s3:GetObject, s3:HeadObject
- s3:DeleteObject, s3:CopyObject

### Env PROD
```
S3_ENDPOINT=https://s3.eu-west-1.io.cloud.ovh.net
S3_REGION=eu-west-1
S3_ACCESS_KEY_ID=<ovh_access_key>
S3_SECRET_ACCESS_KEY=<ovh_secret_key>
S3_BUCKET=<bucket>
S3_FORCE_PATH_STYLE=false
S3_USE_SSL=true
S3_PRESIGN_PUT_TTL_SECONDS=120
S3_PRESIGN_GET_TTL_SECONDS=120
```
