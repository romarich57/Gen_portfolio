| **1 composant = 1 fichier** | Chaque composant doit être dans son propre fichier nommé avec **PascalCase**. |
| **Imports propres** | Imports groupés par type (librairies externes → internes → styles). |
| **Export par défaut** | Utiliser `export default` pour les composants principaux. |

---

# 🎯 **2. Syntaxe & conventions React**

| Bonne pratique | Exemple |
|----------------|----------|
| **Nom des composants** en PascalCase | `function PostList() {}` ✅ |
| **Nom des hooks** en camelCase + préfixe `use` | `useFetchPosts()` ✅ |
| **Props destructurées** | `function PostItem({ post }) {}` |
| **JSX propre** | Une seule racine, pas d’expressions complexes inline. |
| **Fragments React** | `<></>` au lieu de `<div>` inutiles. |
| **Pas de logique métier dans le JSX** | Filtrage, tri et calculs faits avant le `return`. |
| **Composants purs** | Découper en petits composants réutilisables. |
| **Toujours des `key` uniques** dans `.map()` | `key={post.id}` ✅ |
| **Éviter `index` comme clé** | Mauvaise pratique car non stable. |

---

# ⚙️ **3. Gestion d’état et logique**

| Bonne pratique | Exemple / Explication |
|----------------|------------------------|
| **useState / useEffect maîtrisés** | Effets bien ciblés, pas de dépendances inutiles. |
| **Effet propre** | Nettoyage (`cleanup`) dans `useEffect` si nécessaire. |
| **Custom Hooks** | Pour éviter la duplication (`usePosts`, `usePagination`). |
| **Context API ou Zustand/Recoil** | Si plusieurs composants ont besoin d’un même état. |
| **Aucune mutation directe** | Toujours créer de nouveaux objets/tableaux (`setState([...old, new])`). |

---

# 🧩 **4. Appels API (MirageJS ou fetch)**

| Bonne pratique | Exemple |
|----------------|----------|
| **Centraliser les appels API** | Dans `/api/api.js` ou `/services/api.js` |
| **Gestion des erreurs** | `try/catch` systématique, message utilisateur en cas d’erreur. |
| **États loading/error/data** | Affichage conditionnel : chargement, erreur, vide, résultat. |
| **Async/Await** | Jamais de `.then()` en chaîne dans React moderne. |
| **Ne pas appeler l’API dans le rendu** | Toujours dans `useEffect`. |

---

# 🧱 **5. Gestion des composants et réutilisabilité**

| Bonne pratique | Explication |
|----------------|-------------|
| **Responsabilité unique (SRP)** | Un composant = une mission (affichage, liste, filtre, etc.). |
| **Composants contrôlés** | Inputs, select, pagination → toujours pilotés par un état parent. |
| **Composants réutilisables** | Props génériques (`<Button variant="primary" />`). |
| **Proptypes / TypeScript** | Validation des props (`PropTypes` ou interfaces TS). |

---

# 🎨 **6. Styles & design responsive**

| Bonne pratique | Explication |
|----------------|-------------|
| **Responsive** | Mobile-first, flexbox ou CSS Grid. |
| **BEM ou CSS Modules** | `.post-item__title`, ou `PostItem.module.css`. |
| **Variables de couleur** | Définies dans `:root` ou thème. |
| **Préprocesseur ou CSS-in-JS** | Sass, Emotion, Styled-components ou Tailwind ✅ |
| **Dark mode possible** | Thème stocké via Context. |
| **Pas de style inline** sauf exception. |
| **Animations légères** | `transition`, `CSSTransition` ou `framer-motion`. |

---

# 🧭 **7. Navigation (React Router)**

| Bonne pratique | Exemple |
|----------------|----------|
| **React Router v6+** | Utiliser `<Routes>` et `<Route>` |
| **Structure claire** | `/pages/Home.jsx`, `/pages/PostDetail.jsx` |
| **useParams & useSearchParams** | Pour gérer les filtres et la persistance de l’état dans l’URL |
| **Navigation accessible** | Liens `<Link>` ou `<NavLink>` au lieu de `<a href>`. |
| **404 page** | Prévoir une page NotFound simple. |

---

# 🔄 **8. Filtrage & pagination**

| Bonne pratique | Explication |
|----------------|-------------|
| **Filtrage par état parent** | Les filtres changent un state global. |
| **Pagination contrôlée** | Gérée par état local ou URL (page=2). |
| **Lazy loading possible** | Affichage progressif des éléments. |
| **Transitions animées** | Fade-in/out via React Transition Group. |

---

# 🧠 **9. Performance et optimisation**

| Bonne pratique | Explication |
|----------------|-------------|
| **useMemo / useCallback** | Pour éviter les re-rendus inutiles. |
| **React.memo** | Pour les composants stables et purs. |
| **Code splitting / lazy loading** | `React.lazy` + `Suspense` pour charger les pages à la demande. |
| **Pas de re-rendu superflu** | Contrôler les dépendances des hooks. |
| **Pagination côté client** | Éviter de tout charger d’un coup. |
| **Minification + compression** | Gérée par Vite ou Webpack en build prod. |

---

# ♿ **10. Accessibilité (a11y)**

| Bonne pratique | Détails |
|----------------|----------|
| **Balises sémantiques** | `<main>`, `<header>`, `<article>`, `<footer>`… |
| **Attributs `aria-`** | Pour boutons/icônes sans texte. |
| **Alt pour images** | `alt="Post thumbnail"` |
| **Contraste suffisant** | Respect du WCAG 2.1 niveau AA minimum. |
| **Navigation clavier** | Focus visible, tabulation logique. |
| **Labels explicites** | `<label htmlFor="filter">Filtrer par catégorie</label>` |

---

# 🧹 **11. Qualité du code et outils**

| Bonne pratique | Détails |
|----------------|----------|
| **Linting obligatoire** | ESLint + Prettier (`.eslintrc` + `.prettierrc`). |
| **Formatage auto** | `prettier --write .` dans `package.json`. |
| **Convention Git** | Commits clairs : `feat:`, `fix:`, `refactor:`. |
| **Variables bien nommées** | camelCase, pas de noms génériques (`data`, `obj`). |
| **Pas de console.log** | Supprimé en production. |
| **Commentaires JSDoc** | Rôle / préconditions / postconditions pour chaque fonction. |
| **Fichiers courts** | Max 300 lignes par composant. |

---

# 💾 **12. Sécurité & robustesse**

| Bonne pratique | Détails |
|----------------|----------|
| **Validation des entrées** | Ne jamais injecter des entrées brutes dans le DOM. |
| **Échapper le HTML** | Éviter `dangerouslySetInnerHTML`. |
| **Aucune dépendance obsolète** | `npm audit fix` régulier. |
| **Pas de clé API exposée** | Variables d’environnement `.env`. |
| **CORS & HTTPS** | Toujours sur localhost sécurisé si API externe. |

---

# 🧰 **13. Tests et validation**

| Bonne pratique | Détails |
|----------------|----------|
| **Tests unitaires** | Avec Jest + React Testing Library. |
| **Test de rendu** | `screen.getByText()` pour valider l’affichage. |
| **Snapshots** | Pour éviter les régressions visuelles. |
| **Tests manuels** | Mobile, tablette, desktop, dark mode. |

---

# 🗂️ **14. Documentation**

| Bonne pratique | Détails |
|----------------|----------|
| **README complet** | Description, installation, scripts, technologies, auteur. |
| **Commentaires structurés** | Exemple :
  ```jsx
  /**
   * Composant : Filter
   * Rôle : Gère la sélection de catégorie
   * Préconditions : liste de catégories passée en props
   * Postconditions : déclenche la mise à jour du filtre parent
   */


# React.md — Bonnes pratiques React (frontend) + contraintes sécurité

## 0) Objectif
Le frontend React doit fonctionner avec une authentification via **cookies HttpOnly**.
Donc:
- Le front ne peut pas lire les tokens.
- Le front doit gérer:
  - l’état "connecté / non connecté"
  - le CSRF token (non HttpOnly) pour les requêtes state-changing
  - les redirections d’onboarding (email/phone/MFA)

---

## 1) Sécurité front — règles strictes
### 1.1 Interdictions
- Interdiction de stocker des tokens dans localStorage/sessionStorage.
- Interdiction de mettre des secrets (keys) côté client.
- Interdiction de logguer des données sensibles (OTP, tokens, secrets TOTP, etc.).

### 1.2 Requêtes API
- Toujours utiliser `fetch/axios` avec:
  - `credentials: "include"` pour envoyer les cookies
- Pour POST/PUT/PATCH/DELETE:
  - inclure un header `X-CSRF-Token: <token>`
  - et respecter la politique CORS backend
- Centraliser un client HTTP unique (wrapper) qui:
  - gère erreurs 401 (session expirée)
  - redirige vers login
  - peut tenter une fois un refresh (si backend expose un endpoint safe)
  - évite les boucles infinies

### 1.3 XSS: défense côté UI
- Ne jamais utiliser `dangerouslySetInnerHTML` sans sanitation.
- Valider/échapper les champs affichés si rendu HTML.
- Les contenus importés par l’utilisateur (docs) doivent être affichés en mode sûr.

---

## 2) Architecture React recommandée
- Routes publiques: landing, login, register, verify email
- Routes onboarding sécurisées:
  - verify phone
  - setup MFA (TOTP)
  - backup codes
- Routes privées:
  - dashboard
  - profil
  - projets (plus tard)
- Routes admin:
  - panneau admin (RBAC côté API obligatoire)

### 2.1 Gestion d’état
- Un `AuthContext` minimal:
  - `user: {id, email, roles, mfaEnabled, emailVerified, phoneVerified}`
  - `loading`
  - `refreshUser()` => GET /me
- Éviter de dupliquer des infos sensibles en cache.

### 2.2 Formulaires
- Utiliser validation (zod/yup) côté client mais **toujours** revalider côté serveur.
- Afficher les erreurs d’auth de manière neutre (pas d’énumération).

---

## 3) UX flows obligatoires (sécurité)
### 3.1 Onboarding après Register
1) Register OK -> écran: "Vérifie ton email"
2) Email vérifié -> écran: "Vérifie ton téléphone"
3) Téléphone vérifié -> écran: "Active la MFA (TOTP) obligatoire"
4) MFA activée -> dashboard

### 3.2 Login
- Si user n’a pas email vérifié -> rediriger vers écran email verify
- Sinon si phone non vérifié -> écran phone verify
- Sinon si MFA non activée (globale ON) -> écran setup MFA
- Sinon login normal -> si MFA activée: prompt code TOTP

---

## 4) Gestion CSRF côté front
- Le backend fournira un endpoint type `GET /auth/csrf` qui retourne un token.
- Le front stocke ce token en mémoire (state) ou cookie non HttpOnly.
- Requête state-changing => header `X-CSRF-Token`.

---

## 5) Bonnes pratiques performance & propreté
- Code splitting par routes
- Ne pas multiplier les re-renders sur les pages auth
- Composants petits, testables
- Tests UI minimaux sur flows d’onboarding