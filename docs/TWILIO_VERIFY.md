# TWILIO_VERIFY

## Configuration
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `TWILIO_VERIFY_MODE` = `live` (prod) | `mock` (dev uniquement)
- (optionnel) SMS alertes securite:
  - `TWILIO_MESSAGING_SERVICE_SID` **ou** `TWILIO_SMS_FROM`

> En mode `mock`, les SMS ne sont pas envoyés. Code de test: `000000`.

## Endpoints
- `POST /auth/phone/start` (body: `phoneE164`, `country` optionnel)
- `POST /auth/phone/check` (body: `phoneE164`, `code`, `country` optionnel)
> Vérification téléphone optionnelle, accessible après connexion (Profil > Sécurité).

## Limites / lockouts
- Start: 2 req/min/IP (configurable via `app_settings.otp_rate_limits`)
- Check: 5 req/min/IP + lockout après `maxAttempts` (configurable)

## Erreurs
- Réponses neutres (pas d’énumération)
- Audit logs: `PHONE_VERIFY_START`, `PHONE_VERIFIED`, `PHONE_VERIFY_FAILED`, `PHONE_VERIFY_LOCKED`
