# Admin UI Guide (Feature 05)

## Acces
- URL dev: `https://localhost:3002`
- Auth: meme session cookies que l’app utilisateur.
- Aucun login admin dedie. Si non connecte => ecran “Acces admin requis”.

## Navigation
- Overview: KPIs + tendances (inscriptions, upgrades, churn).
- Utilisateurs: recherche, filtres, pagination curseur.
- Details utilisateur: actions sensibles + plan + credits + RGPD.
- Plans & Billing: edition des plans + creation coupons Stripe.
- Credits: ajustements internes.
- Logs: audit logs + filtres.
- Exports: exports RGPD + statut.
- Settings: placeholders (permissions moderateur a venir).

## RGPD (reveal)
Les champs sensibles sont masques par defaut.  
Le bouton “Afficher email” demande une confirmation explicite (texte EXACT **AFFICHER**), puis loggue l’audit.

## Notes
- Plan code V1 = `FREE`, `PREMIUM`, `VIP` (alignement schema existant).
- Les actions admin ecrivent un audit log.
