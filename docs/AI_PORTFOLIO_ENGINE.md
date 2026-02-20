# AI_PORTFOLIO_ENGINE

## 1. Moteur IA (Backend)

Le moteur d'intelligence artificielle est le cœur de l'accélérateur de carrière.

### 1.1 SDK et Intégration
- **Outil** : Utilisation du **Vercel AI SDK** ou d'un SDK natif (Anthropic/OpenAI) encapsulé dans l'API Express.
- **Rôle** : Recevoir le contexte utilisateur (Profil, texte du CV extrait, URLs S3 des images de projets) et les prompts en langage naturel.
- **Output Attendu** : Génération de code source (HTML, Tailwind CSS, composants React) formaté pour un rendu direct.

### 1.2 Streaming et Transport (SSE)
- Les requêtes de génération (ex: `POST /api/ai/generate`) retournent une réponse en streaming via **Server-Sent Events (SSE)** (`text/event-stream`).
- Cela garantit une faible latence perçue : l'utilisateur voit son portfolio se construire en temps réel.

---

## 2. Interface Frontend (Split-Screen UI)

L'UI du générateur se divise en trois zones interactives synchronisées.

### 2.1 Le Chat Conversationnel
- Zone permettant à l'utilisateur de discuter avec l'IA.
- Upload de médias : drag-and-drop de photos de projets (envoyées vers MinIO/S3 via Presigned URLs, puis fournies en contexte à l'IA).

### 2.2 Live Preview (Aperçu en direct)
- **Technologie** : Une iframe sécurisée ou un environnement interactif comme **Sandpack** (composant de CodeSandbox).
- **Fonctionnement** : Le code reçu par SSE est injecté et compilé en temps réel. L'étudiant peut voir le résultat sans recharger la page.
- **Édition WYSIWYG (Hybride)** : Les éléments textuels de la preview peuvent être rendus éditables (`contenteditable` ou via surcouche UI) permettant à l'utilisateur de cliquer et modifier le texte directement, ce qui met à jour le code source de manière bidirectionnelle.

### 2.3 L'Éditeur de Code Intégré
- **Technologie** : **Monaco Editor** (moteur de VS Code).
- Permet aux utilisateurs les plus techniques d'ajuster le HTML/Tailwind/React manuellement.
- Toute modification ici est répercutée instantanément dans la zone Live Preview.

---

## 3. Moteurs d'Export ("Killer Features")

Une fois le portfolio validé, l'utilisateur d'une version compatible peut l'exporter.

### 3.1 Export ZIP côté client
- **Technologie** : Utilisation de **JSZip** côté frontend ou backend.
- L'architecture générée (HTML, CSS, assets JS, images téléchargées) est packagée dans un `.zip` prêt à être hébergé sur n'importe quel serveur (Vercel, Netlify, Apache).

### 3.2 Export GitHub (API Octokit) en 1-clic
- **Prérequis** : L'utilisateur doit avoir lié son compte GitHub (OAuth) via le module Auth existant, avec les scopes de dépôt appropriés (`repo`).
- **Fonctionnement** :
  1. Le backend utilise `octokit` avec le token de l'utilisateur.
  2. Création d'un nouveau repository (ex: `mon-portfolio-dev`).
  3. Poussée (commit + push) de l'ensemble des fichiers générés via l'API Tree/Commit de GitHub.
  4. Activation automatique de **GitHub Pages** sur la branche `main` ou `gh-pages` de ce dépôt.
- **Résultat** : Un lien public et gratuit garanti en quelques secondes.
