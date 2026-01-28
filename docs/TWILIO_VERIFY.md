# TWILIO_VERIFY

## Configuration
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

## Endpoints
- `POST /auth/phone/start`
- `POST /auth/phone/check`

## Limites / lockouts
- Start: 2 req/min/IP (configurable via `app_settings.otp_rate_limits`)
- Check: 5 req/min/IP + lockout après `maxAttempts` (configurable)

## Erreurs
- Réponses neutres (pas d’énumération)
- Audit logs: `PHONE_VERIFY_START`, `PHONE_VERIFIED`, `PHONE_VERIFY_FAILED`, `PHONE_VERIFY_LOCKED`
