# DB_SCHEMA_PORTFOLIO

*(Complément à `DB_SCHEMA_AUTH` et `DB_SCHEMA_BILLING`)*

## Tables

### portfolios
- `id` (PK, UUID)
- `user_id` (FK vers `users.id`, unique si 1 portfolio max par utilisateur, sinon index)
- `title` (Titre du projet de portfolio, ex: "Portfolio Dev Fullstack")
- `custom_domain` (Nullable, si l'on gère le routage DNS plus tard)
- `is_published` (Booléen, pour les versions publiques sur notre propre hébergement futur)
- `html_content` (Text, stockage du dernier code généré)
- `css_content` (Text, nullable)
- `js_content` (Text, nullable)
- `created_at`, `updated_at`, `deleted_at`

### project_images
- `id` (PK, UUID)
- `portfolio_id` (FK vers `portfolios.id`)
- `user_id` (FK vers `users.id`)
- `s3_key` (Chemin relatif MinIO/S3, ex: `users/{user_id}/projects/{uuid}.webp`)
- `alt_text` (Texte alternatif généré par IA ou user)
- `uploaded_at`

### prompt_history
- `id` (PK, UUID)
- `portfolio_id` (FK vers `portfolios.id`)
- `user_prompt` (La demande textuelle de l'utilisateur)
- `ai_response_summary` (Résumé ou checksum du code généré)
- `tokens_used` (Pour le billing et limites mensuelles)
- `created_at`

## Relations clés
- Un utilisateur peut avoir un (ou plusieurs) `portfolios`.
- Un `portfolio` possède plusieurs `project_images`.
- Un `portfolio` garde la trace de son `prompt_history`.

## Contraintes de suppression
- Sur suppression d'un `user_id` (RGPD Purge), suppression en cascade des `portfolios`, qui entraîne la suppression des `project_images` et `prompt_history` (et purge S3 correspondante via jobs asynchrones).
