# CI_SECURITY

## Outils et couverture
- **Dependency scan**: `npm audit --audit-level=high` (fail build si vulnérabilité high/critical)
- **Secret scan**: Gitleaks (fail build si secret détecté)
- **SAST**: Semgrep (fail build si findings high)
- **SBOM**: CycloneDX (artefact généré)
- **Docker image scan**: Trivy (si Dockerfile présent)

## Déclenchement
- **Pull Request**: scan complet
- **Push sur main**: scan complet

## Politique fail build
- Toute vulnérabilité **high/critical** bloque le pipeline.
- Toute détection de secret bloque le pipeline.
- Findings SAST severity **high** bloquants.

## Artefacts
- SBOM JSON uploadé en artifact CI.
