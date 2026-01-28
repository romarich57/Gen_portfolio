# Feature 04 — Frontend User React (Auth + OAuth + MFA + Profile(Onboarding intégré) + Billing + Pricing) — HTTPS DEV
Dépendances strictes: Features 00–03 validées. Backend prêt et testable via API.

## Objectif
Implémenter le frontend USER en React + TypeScript strict, responsive, avec :
- Landing page (site vide au début) qui affiche Pricing (Free / Premium / VIP) + CTA
- Auth complet:
  A) Register
  B) Verify email (token dans URL)
  C) Login
  D) Phone verify (Twilio)
  E) MFA setup + affichage backup codes
  F) MFA challenge au login
  G) Forgot password (request + confirm)
  H) OAuth callback (Google/GitHub)
- Profile page qui inclut onboarding intégré (choix utilisateur): si onboarding manquant, afficher un bloc obligatoire en haut de “Profile”
- Billing page:
  - afficher plan actuel
  - bouton Upgrade => redirection Stripe Checkout
  - bouton Manage => redirection Stripe Customer Portal
- Sécurité front:
  - AUCUN token en localStorage/sessionStorage
  - cookies HttpOnly only
  - fetch avec credentials: "include" partout
  - CSRF token en mémoire + header X-CSRF-Token
  - gestion erreurs neutres + codes backend
- UI: Tailwind + shadcn/ui, responsive, thème dark/light toggle

En dev, tout doit tourner en HTTPS via Nginx + certificat auto-signé (tu dois documenter la procédure).

---

## A) Décisions techniques imposées
- React + TypeScript strict
- Tailwind + shadcn/ui
- Routing: React Router
- Data fetching/cache: TanStack React Query
- HTTP: fetch + wrapper
- Auth: cookies HttpOnly (backend)
- CSRF: GET /auth/csrf + stockage token en mémoire + envoi header X-CSRF-Token sur state-changing
- Base URLs DEV:
  - Front: https://localhost:3000
  - API: https://localhost:4000
- Mode HTTPS dev: Nginx reverse proxy + certificat auto-signé

---

## B) Livrables attendus (OBLIGATOIRES)
Créer / mettre à jour dans repo FRONTEND USER :

1) `README_DEV_HTTPS.md`
- Comment lancer le front en HTTPS via Nginx (local) + cert auto-signé
- Comment configurer CORS/cookies côté backend pour https://localhost:3000
- Checklist “cookies HttpOnly ok” + “CSRF ok”

2) `API_CONTRACT_UI.md`
- Liste des endpoints consommés + codes d’erreurs attendus (EMAIL_NOT_VERIFIED, PHONE_NOT_VERIFIED, MFA_SETUP_REQUIRED, MFA_CHALLENGE_REQUIRED, ONBOARDING_REQUIRED, etc.)
- Règles UI associées à chaque code

3) `SECURITY_FRONT.md`
- Interdiction storage tokens
- CSRF flow
- credential include
- règles d’erreur neutre
- recommandations CSP (côté backend)

4) Tests front minimum:
- tests unitaires du wrapper API (ajout CSRF, gestion 401/403)
- tests de routing guards (private route, etc.)
(Si pas de framework test en place, documenter clairement ce qui manque en feedback.)

---

## C) Architecture fichiers (imposée)
src/
  app/
    App.tsx
    router.tsx
    providers/
      QueryProvider.tsx
      ThemeProvider.tsx
      AuthBootstrap.tsx    # récup /auth/csrf + /me au démarrage
    layout/
      PublicLayout.tsx
      PrivateLayout.tsx
  api/
    http.ts               # fetch wrapper (credentials include, headers, error normalize)
    csrf.ts               # getCsrfToken()
    auth.ts               # register/login/logout/refresh/emailVerify/passwordReset/phone/mfa/oauth
    me.ts                 # getMe, patchMe, patchOnboarding (si endpoints distincts)
    billing.ts            # getStatus, createCheckoutSession, createPortalSession
  components/
    ui/                   # shadcn
    common/
      ErrorBanner.tsx
      Loading.tsx
      ThemeToggle.tsx
      ProtectedRoute.tsx
  pages/
    public/
      LandingPricing.tsx
      Login.tsx
      Register.tsx
      VerifyEmail.tsx
      ForgotPassword.tsx
      ResetPassword.tsx
      OAuthCallback.tsx
    private/
      Dashboard.tsx
      Profile.tsx          # inclut onboarding intégré en haut si non complété
      Billing.tsx
      PhoneVerify.tsx
      MfaSetup.tsx
      MfaChallenge.tsx

---

## D) Contrat API minimal (ne pas inventer)
Le front doit s’adapter au backend. Si un endpoint manque, créer un ticket /feedback et proposer la modification backend.

### CSRF
- GET /auth/csrf
  - Response: { csrfToken: string }
  - Front: conserve en mémoire (React Query cache) et ajoute `X-CSRF-Token` sur POST/PATCH/DELETE.

### /me
- GET /me -> retourne onboarding_completed_at et champs profil
- PATCH /me -> update profil (username illimité)
- Si backend a PATCH /me/onboarding séparé, utiliser. Sinon, intégrer dans PATCH /me.

### Auth
- POST /auth/register
- GET /auth/email/verify?token=
- POST /auth/login
- POST /auth/logout
- POST /auth/password/reset/request
- POST /auth/password/reset/confirm
- POST /auth/phone/start
- POST /auth/phone/check
- POST /auth/mfa/setup/start
- POST /auth/mfa/setup/confirm
- POST /auth/mfa/verify
- OAuth:
  - GET /auth/oauth/:provider/start (redirige)
  - GET /auth/oauth/:provider/callback (redirige vers front OAuthCallback avec params safe)

### Billing
- GET /billing/status (plan actuel, roles, entitlements)
- POST /billing/checkout-session (returns checkout_url)
- POST /billing/portal-session (returns portal_url)

---

## E) Règles UI strictes (flows sans omission)

### E1) LandingPricing
- Afficher 3 plans: Free (1 projet), Premium (10€/mois, 5 projets), VIP (30€/mois, illimité)
- CTA:
  - “Commencer gratuit” => Register
  - “Se connecter” => Login
- Si user connecté: bouton “Aller au Dashboard”

### E2) Register
- Form email/password
- On success: afficher message “check email”
- Ne jamais révéler si email existe (message neutre)

### E3) VerifyEmail
- Lire token dans URL
- Appeler backend
- Si ok => afficher “Email vérifié” + bouton “Continuer” (login ou auto si session)
- Si fail => message neutre

### E4) Login
- Form email/password
- Gérer codes:
  - EMAIL_NOT_VERIFIED => lien “renvoyer email” si endpoint existe, sinon feedback
  - PHONE_NOT_VERIFIED => rediriger PhoneVerify
  - MFA_SETUP_REQUIRED => rediriger MfaSetup
  - MFA_CHALLENGE_REQUIRED => rediriger MfaChallenge
  - ONBOARDING_REQUIRED => rediriger Profile (onboarding intégré)
- Toujours erreurs neutres en UI

### E5) PhoneVerify
- Start: saisir phone_e164 -> POST /auth/phone/start
- Check: saisir code -> POST /auth/phone/check
- Puis rediriger vers MFA setup si requis

### E6) MFA Setup + Backup Codes
- Start -> reçoit provisioning URI / QR data
- Confirm -> saisie code TOTP
- Afficher backup codes une fois (obligatoire) + checkbox “j’ai sauvegardé”
- Puis redirect Dashboard/Profile

### E7) MFA Challenge
- Saisie code TOTP (ou backup code si supporté)
- POST /auth/mfa/verify
- Si ok => Dashboard

### E8) Forgot/Reset Password
- Request: email -> message neutre
- Confirm: token + new password -> succès => login

### E9) OAuth Callback
- Page front qui lit params “status/code”
- Appeler GET /me pour connaître état
- Router selon besoins: phone/mfa/onboarding/dashboard

### E10) Profile (onboarding intégré)
- GET /me
- Si onboarding_completed_at == null:
  - afficher un encart obligatoire en haut avec form (first_name, last_name, username, nationality)
  - submit -> PATCH /me (ou PATCH /me/onboarding) + CSRF
- En dessous: form profil modifiable (username illimité)

### E11) Billing
- GET /billing/status
- Afficher plan + limites
- Boutons:
  - Upgrade => POST /billing/checkout-session => window.location = checkout_url
  - Manage => POST /billing/portal-session => window.location = portal_url

---

## F) Wrapper fetch (obligatoire)
`api/http.ts` doit:
- toujours utiliser `credentials: "include"`
- ajouter `X-CSRF-Token` si méthode state-changing
- normaliser erreurs:
  - retourne { code, message, request_id } si possible
- gérer 401 => redirect login (sauf sur public pages)
- ne log jamais de données sensibles

---

## G) HTTPS DEV via Nginx (obligatoire)
Tu dois fournir une config Nginx de dev (README_DEV_HTTPS.md) :
- https://localhost:3000 -> front dev server
- https://localhost:4000 -> backend
- certificat auto-signé local
- IMPORTANT: backend doit accepter CORS origin https://localhost:3000 et credentials.

---

## H) Critères d’acceptation (DoD)
- Toutes pages A→H existent + flows fonctionnels
- Cookies HttpOnly fonctionnent en HTTPS dev (pas de storage tokens)
- CSRF token récupéré et envoyé correctement
- Onboarding intégré dans Profile (bloque l’accès produit tant que non complété)
- Billing upgrade + portal redirigent correctement
- UI responsive + dark/light toggle
- Docs livrés + feedback si manque backend