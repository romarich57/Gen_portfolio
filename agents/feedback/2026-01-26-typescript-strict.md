# 2026-01-26 — Migration TypeScript strict

- Date: 2026-01-26
- Contexte: Nouvelle exigence repo — backend et frontend doivent être en TypeScript avec typage strict.
- Problème: Le backend existant est actuellement en JavaScript (Feature 00 initiale).
- Impact sécurité (piliers): 1 (SDLC/qualité), 12 (supply chain/CI), 15 (tests) — risque d’incohérence si la migration est retardée.
- Décision / Fix: Geler l’implémentation de nouvelles features tant que la base backend n’est pas migrée en TypeScript strict. Conversion prévue en priorité avant Feature 01.
- Validation (tests / preuve): À faire après migration (tsc --noEmit, tests unit/int/sécu).
