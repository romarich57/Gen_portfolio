# AVATAR_UPLOAD_SECURITY

## Contraintes
- Taille max: 2 MB
- Types autorisés: image/jpeg, image/png, image/webp
- Interdiction SVG

## Flux sécurisé
1) POST /me/avatar/upload-url
   - Validation mime/size
   - Création `files` status=pending
   - Pre‑signed PUT TTL 60–120s (env `S3_PRESIGN_PUT_TTL_SECONDS`)
2) Upload client via PUT
3) POST /me/avatar/confirm
   - HEAD S3 (content-type + content-length)
   - Activation + désactivation ancien avatar

## Object keys
- `avatars/{userId}/{uuid}`
- Ancien avatar déplacé vers `avatars/old/{userId}/{uuid}` (purge lifecycle)

## Cache-control (recommandé)
- `Cache-Control: private, max-age=300`

## Audits
- AVATAR_UPLOAD_URL_ISSUED
- AVATAR_SET_ACTIVE
