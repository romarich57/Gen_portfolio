# Security Audit And Fixes

## Fixes appliques

- Tous les endpoints CV sont derriere `requireAuth`.
- Les mutations CV utilisent les protections CSRF globales existantes.
- Les acces CV utilisent `ownerUserId` dans les requetes Prisma.
- Les payloads CV/IA sont valides par Zod.
- Les contenus HTML CV passent par sanitation serveur avant stockage.
- Les routes IA refusent les champs client `apiKey`, `model`, `provider`, `apiEndpoint`.
- Gemini est configure uniquement cote backend via env.
- Les logs redactent `content`, `text`, `resume`, `prompt`, `apiKey`, `model`, `provider`, `apiEndpoint`.
- Rate limits dedies ajoutes pour CV et IA.
- `locale` backend limite a `fr|en`.

## Points ASVS impactes

- Auth/session: socle existant conserve.
- Access control: ownership CV strict.
- Input validation: schemas Zod CV/IA.
- API security: CSRF, rate limiting, erreurs uniformes.
- Data handling: pas de secret IA ni token session cote frontend.
- Audit/logging: usage IA trace sans PII brute.
- Secrets: `GEMINI_API_KEY` env uniquement.

## Gaps non bloquants cote code mais a valider

- Tests backend DB non executes avec succes faute de credentials PostgreSQL valides.
- Admin CV avec revelation MFA recente reste a implementer completement.
- Export PDF worker interne doit etre branche a l'infrastructure jobs existante.
