# README_DEV_HTTPS

## Objectif
Activer HTTPS en local via Nginx pour:
- Frontend: https://localhost:3000
- API: https://localhost:4000

## 1) Generer un certificat auto-signe
```bash
mkdir -p ops/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ops/certs/localhost.key \
  -out ops/certs/localhost.crt \
  -subj "/CN=localhost"
```

## 2) Configurer Nginx (dev)
Le fichier `ops/nginx/dev_https.conf` fournit une base. Il est deja rempli avec le chemin absolu
du repo courant. Mettez a jour ces chemins si vous deplacez le projet:
- `ssl_certificate` et `ssl_certificate_key`
- Le backend est proxifie vers `http://127.0.0.1:4100` (voir etape 3).

Lancer Nginx (exemple):
```bash
nginx -c /ABS/PATH/TO/ops/nginx/dev_https.conf
```
Arreter:
```bash
nginx -s stop
```

## 3) Lancer backend + frontend en HTTP internes
Backend (expose en http sur 4100):
```bash
cd apps/backend
PORT=4100 NODE_ENV=development npm run dev
```

Frontend (Vite en http sur 5173):
```bash
cd apps/frontend
npm install
npm run dev
```

## 4) Variables d'environnement
Frontend (`apps/frontend/.env`):
```
VITE_API_BASE_URL=https://localhost:4000
VITE_APP_BASE_URL=https://localhost:3000
```

Backend (`apps/backend/.env` ou env shell):
```
APP_BASE_URL=https://localhost:3000
CORS_ORIGINS=https://localhost:3000
HTTPS_ENABLED=true
TRUST_PROXY=1
```

## 5) Checklist HTTPS (cookies + CSRF)
- Cookies HttpOnly envoyes sur https://localhost:3000
- `GET /auth/csrf` retourne un token et set `csrf_token`
- Les POST/PATCH/DELETE ajoutent `X-CSRF-Token`
- Aucune valeur sensible stockee dans localStorage/sessionStorage

## 6) Notes
- Le navigateur affichera un avertissement pour certificat auto-signe.
- Pour eviter l'avertissement, utiliser un certificat local de confiance (ex: mkcert).
