# OAUTH_GOOGLE_GITHUB

## PKCE + State
- `GET /auth/oauth/:provider/start` génère `code_verifier` + `code_challenge`.
- `state` stocké en cookie signé (anti‑CSRF).
- Callback vérifie `state` + PKCE.

## Providers
### Google
- Scope: `openid email profile`
- Userinfo: `https://openidconnect.googleapis.com/v1/userinfo`

### GitHub
- Scope: `read:user user:email`
- Email vérifié via endpoint `/user/emails`

## Linking rules
- Email OAuth considéré comme vérifié (Google/GitHub).
- Si user existe → link du provider au compte existant.
- Sinon création user avec profil incomplet → UI force `CompleteProfile` (prénom/nom/pseudo/nationalité).

## Redirect
- `OAUTH_REDIRECT_BASE_URL` utilisé pour les callbacks.
- Vous pouvez surcharger par provider:
  - `OAUTH_GOOGLE_REDIRECT_URI`
  - `OAUTH_GITHUB_REDIRECT_URI`

### Redirect URIs à enregistrer (dev HTTPS)
Google:
- `https://localhost:4000/auth/oauth/google/callback`

GitHub:
- `https://localhost:4000/auth/oauth/github/callback`
