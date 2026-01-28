# OPENAPI_BASE

## Conventions générales
- **Content-Type**: `application/json`
- **Correlateur**: `X-Request-Id` (retourné sur toutes les réponses)
- **Erreurs neutres** (anti-enum)

## Format d’erreur
```json
{
  "error": "STRING_CODE",
  "message": "Human readable (neutre)",
  "request_id": "uuid"
}
```

## Status codes
- 200 OK / 201 Created
- 204 No Content
- 400 Bad Request (validation)
- 401 Unauthorized (auth requise)
- 403 Forbidden (authz/CSRF/CORS)
- 404 Not Found
- 409 Conflict
- 422 Unprocessable Entity
- 429 Too Many Requests (rate limit)
- 500 Internal Server Error

## Pagination
- Query params: `page`, `page_size`
- Réponse:
```json
{
  "data": [],
  "page": 1,
  "page_size": 20,
  "total": 120
}
```

## Sécurité
- Cookies HttpOnly (access/refresh)
- CSRF: `X-CSRF-Token` + Origin/Referer strict
- CORS allowlist stricte
