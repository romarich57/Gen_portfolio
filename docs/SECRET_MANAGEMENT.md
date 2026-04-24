# Secret Management Runbook

## Source of truth
- Runtime secrets doivent provenir de Doppler.
- Les postes développeur ne doivent pas conserver de `.env` longue durée.

## Local
- Lancer le backend via `doppler run -- npm --prefix apps/backend run dev`
- Lancer le worker via `doppler run -- npm --prefix apps/backend run worker:dev`
- Lancer les tests backend via `doppler run -- npm --prefix apps/backend test`

## CI
- Les workflows valident les fichiers d’exemple via `npm run env:validate:examples`.
- Les secrets doivent être injectés au runtime CI via Doppler ou variables GitHub, jamais committés.

## Hook local
- Activer les hooks: `git config core.hooksPath .githooks`
- Le hook `pre-commit` exécute:
  - `gitleaks protect --staged`
  - `npm run env:validate:examples`

## Rotation MFA master key
- Pré-requis:
  - `OLD_MFA_MASTER_KEY` = ancienne clé base64 32 bytes
  - `MFA_MASTER_KEY` = nouvelle clé base64 32 bytes
  - `DATABASE_URL` valide
- Dry-run:
  - `doppler run -- npm --prefix apps/backend run security:mfa-reencrypt -- --dry-run`
- Exécution:
  - `doppler run -- npm --prefix apps/backend run security:mfa-reencrypt`
- Le script est idempotent: un secret déjà réchiffré avec la nouvelle clé est ignoré.
