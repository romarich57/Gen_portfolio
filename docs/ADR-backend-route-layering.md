# ADR - Backend Route Layering (service-first pragmatique)

## Statut
Accepted

## Contexte
Le backend avait une couche transitoire de découpage (`legacy.router.ts` + proxy de matching) qui maintenait le contrat API mais conservait un couplage fort routes/legacy.

## Décision
1. Adopter un layering `routes -> domain use-cases/services -> repositories`.
2. Interdire Prisma dans `routes/*` (Prisma autorisé côté domaines/services/repositories).
3. Supprimer la phase transitoire proxy (`createLegacyRouteProxy`) et tous les `legacy.router.ts`.
4. Garder le contrat HTTP public inchangé.

## Conséquences
1. Routeurs `auth`, `me`, `adminApi` restent des façades stables et lisibles.
2. Les handlers sont rattachés aux domaines (`apps/backend/src/domains/*/use-cases`).
3. Les règles d'architecture et les tests statiques bloquent toute réintroduction d'artefacts legacy.
4. Le risque de régression API est limité par les tests d'intégration/sécurité existants.
