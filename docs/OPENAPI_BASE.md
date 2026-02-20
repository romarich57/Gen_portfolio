# OPENAPI_BASE

## Statut du contrat API
- Le refactor backend "route layering" (suppression de la couche legacy/proxy) ne change pas le contrat HTTP public.
- Les endpoints, méthodes, payloads, statuts, cookies et invariants clients restent identiques.

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
- 503 Service Unavailable (dépendance sécurité indisponible, ex: store rate-limit OTP)
- 500 Internal Server Error

## Pagination
- Query params: `page`, `page_size`
- Réponse:

## Streaming AI (Nouveau)
- Pour la génération de code IA, les endpoints (ex: `POST /api/ai/generate`) utiliseront **Server-Sent Events (SSE)**.
- Content-Type de la réponse : `text/event-stream`.
- Format des données : JSON encodé en string dans l'événement `data: {...}`.
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
