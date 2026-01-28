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
- Email non vérifié → pas d’auto‑link.
- Email vérifié → link si user existe.
- Sinon création user avec onboarding (phone + MFA).

## Redirect
- `OAUTH_REDIRECT_BASE_URL` utilisé pour les callbacks.
