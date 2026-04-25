# AI Resume Generation Architecture

## Provider

Le provider est choisi par l'application, pas par l'utilisateur.

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `AI_TIMEOUT_MS`

En test, `AI_PROVIDER=mock` fournit une sortie deterministe.

## Interfaces

- `AiProvider`: contrat minimal pour generer une reponse structuree.
- `ResumeGenerationService`: orchestre import, polish et grammar.
- `AiUsageService`: trace operation, statut, latence et credits.

## Endpoints

- `POST /api/ai/resume/import`
- `POST /api/ai/resume/polish`
- `POST /api/ai/resume/grammar`
- `GET /api/ai/usage`

## Securite

- Aucun choix de modele/provider dans l'UI.
- Aucun secret IA expose au navigateur.
- Timeout cote serveur.
- Sortie Zod stricte.
- Logs sans contenu CV brut.
- Rate limit sur routes IA.

## Fallback

En cas d'erreur provider, l'API renvoie une erreur controlee et le CV reste editable manuellement.
