# AI-First Portfolio Generator SaaS
**(Anciennement React_auth_Billing_security / Saas_builder)**

Un "Accélérateur de carrière" propulsé par l'IA destiné aux étudiants et jeunes diplômés. Ce SaaS permet aux utilisateurs d'uploader leur CV et les photos de leurs projets, pour ensuite dialoguer avec une IA afin de générer un portfolio web ultra-personnalisé, sans aucun template prédéfini.

## ✨ Vision & Fonctionnalités clés (AI-First)
- **Génération IA en Streaming (Server-Sent Events) :** L'utilisateur dialogue avec l'IA (via prompt) pour construire itérativement son portfolio (HTML/Tailwind/React) à partir de son profil, de son CV et de ses images.
- **Interface Split-Screen Innovante :**
  - Outil de Chat conversationnel.
  - Live Preview (Aperçu en direct via iframe/Sandpack).
  - Éditeur de Code intégré (Monaco Editor).
- **Édition Hybride (WYSIWYG & Code) :** Ajustez le contenu textuel généré directement sur la prévisualisation ou affinez le rendu dans le code source.
- **Export "Killer Features" :**
  - **Export ZIP :** Génération et compilation des assets côté client pour téléchargement.
  - **Export GitHub :** Déploiement en 1-clic sur GitHub Pages via l'API GitHub (Octokit) grâce à l'authentification OAuth.

## 🏗 Architecture "Enterprise-grade" (La Base Technique)
Le projet conserve une base robuste, éprouvée et axée sur la plus haute sécurité :
- **Monorepo Structure :**
  - `/apps/backend` : Node.js, Express 5, TypeScript. Fournit l'API REST sécurisée et gère le moteur d'IA via SDK.
  - `/apps/frontend` : React 19, Vite, TailwindCSS, TypeScript. Fournit l'interface utilisateur Split-Screen.
  - `/frontends_admin` : React 19, Vite. Panneau de contrôle d'administration.
- **Base de Données :** PostgreSQL 16 + Prisma ORM.
- **Sécurité et Authentification :**
  - Cookies HttpOnly stricts (aucun token JWT exposé côté client).
  - Protection CSRF sur toutes les requêtes state-changing (POST/PUT/PATCH/DELETE).
  - MFA (Twilio TOTP), Auth Google & GitHub.
- **Stockage Objets (S3/MinIO) :** Hébergement des images utilisateurs via URLs pré-signées éphémères (RGPD compliant).
- **Billing (Monétisation) :** Stripe intégré de bout-en-bout avec wekbooks sécurisés.
- **Jobs asynchrones (RGPD) :** Worker dédié pour traiter `GDPR_EXPORT`/`GDPR_PURGE` sans intervention manuelle.

### Backend Route Layering (sans legacy proxy)
- Les routes HTTP `auth`, `me`, `adminApi` sont composées en sous-routeurs finaux (`*.route.ts`).
- La logique de traitement est déplacée côté domaine (`apps/backend/src/domains/*/use-cases`).
- Les artefacts de transition (`legacy.router.ts`, `createLegacyRouteProxy`) ont été supprimés.
- Contrat API public conservé (mêmes paths, méthodes, payloads, statuts/cookies).

## 📁 Arborescence Conceptuelle
```
/
├── apps/
│   ├── backend/          # API REST Node.js/Express, Moteur AI, Octokit (GitHub API), Webhooks Stripe
│   └── frontend/         # UI Split-Screen: Chat IA + Live Preview (Sandpack/iframe) + Monaco Editor
├── frontends_admin/      # Dashboard de gestion (Comptes, Metrics, Billing, Modération de prompts)
├── docs/                 # Spécifications API, Moteur IA, BDD, Sécurité, Architecture
├── ops/                  # Configurations Docker, Nginx, CI/CD, Infra Cloud
├── docker-compose.yml    # Environnement Local complet (Postgres, MinIO, Redis)
└── Agents.md             # Contraintes et règles IA (Security-First)
```

## 📜 Documentation & Spécifications
Consultez le dossier `/docs` pour le détail des implémentations :
- [Moteur IA & Architecture Split-Screen](docs/AI_PORTFOLIO_ENGINE.md) (Nouveau)
- [Modèles de Données Portfolio](docs/DB_SCHEMA_PORTFOLIO.md) (Nouveau)
- [Sécurité API & Auth](docs/AUTH_SPEC.md)
- [Gestion des Fichiers Cloud (S3)](docs/S3_STORAGE_SETUP.md)
- [Spécifications Stripe (Billing)](docs/BILLING_SPEC.md)
- [Spécification Queue & Worker](docs/JOBS_QUEUE_SPEC.md)

## 🔧 Runbook Worker (GDPR)
- Dev local:
  - `npm --prefix apps/backend run worker:dev`
  - ou `docker compose -f docker-compose.dev.yml --profile dev up backend_worker`
- Production:
  - service `backend_worker` dans `docker-compose.prod.yml`
  - `SERVICE_MODE=worker` et `RUN_MIGRATIONS=false`

## ✅ Politique Qualité Node.js
- Backend lint strict: `npm --prefix apps/backend run lint` (`eslint --max-warnings=0` + `tsc --noEmit`)
- Typecheck explicite: `npm --prefix apps/backend run typecheck`
- Versions de dépendances épinglées (pas de `^` / `~`) sur:
  - `apps/backend/package.json`
  - `apps/frontend/package.json`
  - `frontends_admin/package.json`
- Contrôle automatique du pinning:
  - `npm run deps:check-pinned`
  - exécuté aussi en CI (`ci-security.yml`, `deploy.yml`)

---
*Ce projet est maintenu sous les directives strictest de l'OWASP ASVS et des bonnes pratiques de Clean Code et DevOps.*
