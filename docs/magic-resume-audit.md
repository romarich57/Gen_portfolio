# Magic Resume Audit

## Scope

Audit du dossier `magic-resume` pour extraction controlee vers CV Genius.

## Architecture constatee

- App React/TanStack Start autonome.
- Types CV riches dans `src/types/resume.ts` et `src/types/template.ts`.
- Templates dans `src/components/templates/*`.
- Editeur, preview, grammaire, polish et stores Zustand.
- I18n propre au projet avec locales `zh/en`.
- Generation IA configurable cote utilisateur, avec stores contenant clefs API/modeles.
- Exports et snapshots de templates presents.

## Elements a extraire

- Modeles de donnees CV et sections: personal info, experiences, education, skills, languages, projects, certifications, links.
- Logique de templates et preview apres adaptation au design system principal.
- Logique de transformation, markdown/export JSON, polish/grammar comme cas d'usage backend.
- Concepts d'editeur manuel et de galerie de templates.

## Elements a ne pas importer

- App shell TanStack Start.
- Routes API propres a `magic-resume`.
- Persistance `localStorage` comme source de verite.
- Configuration IA par l'utilisateur (`apiKey`, `model`, `provider`, `apiEndpoint`).
- Proxy image et export externe `api.magicv.art`.
- I18n `zh/en` comme source finale.
- Secrets ou `.env` du dossier source.

## Risques

- `useResumeStore.ts` est volumineux et melange persistance, edition, templates et filesystem.
- Les stores IA exposent des clefs et modeles cote client, incompatibles avec les contraintes CV Genius.
- Les exports PDF doivent etre executes cote serveur/worker isole.

## Decision

Integration par extraction et reimplementation progressive, pas par montage de sous-application.
