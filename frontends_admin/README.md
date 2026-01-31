# Admin App (Feature 05)

## Prerequis
- Node 22+
- Backend tourne sur `https://localhost:4000`
- Cookies admin valides (login via app principale)

## Variables d'env (dev)
Copier `.env.example` vers `.env` si besoin.

```
VITE_ADMIN_API_BASE_URL=https://localhost:4000
VITE_MAIN_APP_URL=https://localhost:3000
```

## Demarrage
```
npm install
npm run dev
```
Par defaut: http://localhost:5174 (Vite).

## Seed admin (dev)
```
cd apps/backend
npm run prisma:seed
```

## HTTPS via Nginx (recommande)
Utiliser `docker-compose.dev.yml` (Nginx expose https://localhost:3002).

## Tests
```
npm run test
npm run test:e2e
npm run test:e2e:https
```
