# SaaS Builder Cleanup Plan

## Objectif

Supprimer le flou produit entre l'ancien SaaS Builder/portfolio generator et CV Genius.

## Traces traitees

- Branding frontend user remplace par `CV Genius`.
- Branding admin remplace par `CV Genius Admin`.
- Package names backend/frontend/admin renommes.
- JWT issuer remplace par `cv-genius`.
- MFA issuer remplace par `CV Genius`.
- Emails de securite remplaces par branding CV Genius.
- Ancienne page publique projet/pricing supprimee.

## Traces conservees temporairement

- Migrations historiques et champs DB legacy `projectLimit/projectsUsed`.
- Docs historiques d'implementation et schemas legacy, utiles pour contexte audit/migration.
- Noms de base de test existants, a migrer dans une coupure controlee.

## Regles de nettoyage

- Une route/UI visible ne doit plus mentionner SaaS Builder.
- Les concepts `brief`, `specs`, `project builder` sont supprimes ou remplaces par CV/resume.
- Les modules techniques auth/MFA/profil/billing/admin restent, meme s'ils proviennent du socle SaaS.
- Toute suppression de champ DB legacy attend une migration de compatibilite separee.

## Verification

Grep actif sur `apps/backend/src`, `apps/frontend/src`, `frontends_admin/src`, tests et HTML: aucune trace UI finale `SaaS Builder`, `SaaS//Builder`, `brief`, `specs`, `project builder`.
