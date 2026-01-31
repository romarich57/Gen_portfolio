# README_DEV_HTTPS

## Objectif
Activer HTTPS en local via Nginx pour:
- Frontend user: https://localhost:3000
- Admin App: https://localhost:3002
- API: https://localhost:4000

## 1) Methode recommandee: Docker + Nginx (HTTPS termine par Nginx)
Celle-ci utilise `docker-compose.dev.yml` et expose:
- Frontend user: https://localhost:3000
- Admin App: https://localhost:3002
- API: https://localhost:4000
- MinIO: http://localhost:9001
- Redis: localhost:6379

Etapes:
```bash
# Generer des certificats auto-signes
./ops/scripts/generate-certs.sh

# Lancer toute la stack
docker compose -f docker-compose.dev.yml up
```

Verification rapide:
```bash
curl -k https://localhost:4000/health
```

Notes importantes:
- Le backend ecoute en HTTP **dans le reseau Docker** (port 4100) mais est expose en HTTPS via Nginx.
- `HTTPS_ENABLED=true` est requis pour marquer les cookies en `Secure` meme derriere Nginx.
- Ne pas definir `HTTPS_CERT_PATH/HTTPS_KEY_PATH` dans Docker (Nginx fait le TLS).

## 2) Variables d'environnement (compose ou .env)
Backend (dans `docker-compose.dev.yml` ou `apps/backend/.env`):
```
APP_BASE_URL=https://localhost:3000
APP_URL=https://localhost:3000
CORS_ORIGINS=https://localhost:3000
OAUTH_REDIRECT_BASE_URL=https://localhost:4000
TRUST_PROXY=1
HTTPS_ENABLED=true
```

Frontend user (`apps/frontend/.env`):
```
VITE_API_BASE_URL=https://localhost:4000
VITE_APP_BASE_URL=https://localhost:3000
```

Frontend admin (`frontends_admin/.env`):
```
VITE_ADMIN_API_BASE_URL=https://localhost:4000
VITE_MAIN_APP_URL=https://localhost:3000
```

## 3) Methode alternative: Nginx local (hors Docker)
Si vous ne voulez pas Docker, vous pouvez lancer Nginx localement.

### 3.1 Generer un certificat auto-signe
```bash
mkdir -p ops/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ops/certs/localhost.key \
  -out ops/certs/localhost.crt \
  -subj "/CN=localhost"
```

### 3.2 Configurer Nginx (dev)
Le fichier `ops/nginx/dev_https.conf` fournit une base:
- `ssl_certificate` et `ssl_certificate_key` pointent vers `ops/certs/localhost.*`
- Le backend est proxifie vers `http://127.0.0.1:4100` (voir etape 3.3).

Lancer Nginx (exemple):
```bash
nginx -c /ABS/PATH/TO/ops/nginx/dev_https.conf
```
Arreter:
```bash
nginx -s stop
```

### 3.3 Lancer backend + frontend en HTTP internes
Backend (expose en http sur 4100):
```bash
cd apps/backend
PORT=4100 NODE_ENV=development npm run dev
```

Frontend user (Vite en http sur 5173):
```bash
cd apps/frontend
npm install
npm run dev
```

Frontend admin (Vite en http sur 5174):
```bash
cd frontends_admin
npm install
npm run dev
```

## 4) Checklist HTTPS (cookies + CSRF)
- Cookies HttpOnly envoyes sur https://localhost:3000
- `GET /auth/csrf` retourne un token et set `csrf_token`
- Les POST/PATCH/DELETE ajoutent `X-CSRF-Token`
- Aucune valeur sensible stockee dans localStorage/sessionStorage

## 5) Notes
- Le navigateur affichera un avertissement pour certificat auto-signe.
- Pour eviter l'avertissement, utiliser un certificat local de confiance (ex: mkcert).
