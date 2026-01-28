# EMAIL_SMTP_GMAIL

## Configuration
Variables d’environnement:
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_USER` = adresse Gmail
- `SMTP_PASS` = App Password (Google)
- `SMTP_FROM` = nom + email expéditeur

## Sécurité
- Utiliser un **App Password**, jamais le mot de passe principal.
- Activer 2FA sur le compte Gmail.
- Pas de secrets dans le repo.

## Templates
- **Vérification email**: lien vers `${OAUTH_REDIRECT_BASE_URL}/auth/email/verify?token=...`
- **Reset password**: lien frontend `/reset-password?token=...`

## Anti‑phishing
- Contenu clair, domaine officiel, pas de lien raccourci.
- Expiration tokens 1h.
