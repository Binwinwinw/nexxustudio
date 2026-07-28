---
name: react-doctor-audit
description: Audit déterministe de codebase React via React Doctor (CLI). Utiliser quand l'utilisateur demande d'auditer, scanner ou noter la santé d'un projet React/Vite/Next (repo ou diff), pas pour un simple snippet collé ni pour une explication conceptuelle G40.
argument-hint: "[chemin racine ou --diff main]"
---

# Skill — React Doctor Audit (G48 / REACT_AUDIT_V1)

## Objectif

Lancer **React Doctor** sur un projet React local, consommer sa sortie structurée, et la présenter selon la doctrine Citadelle (priorités, ton G41, pas d'hallucination).

**Spec** : `docs/agents/react-audit-g48-spec.md`

## Quand utiliser

- « Audite le repo React / le front Vite »
- « Scan react-doctor sur ce projet »
- « Quel est le score santé React ? »
- « Audite mes changements vs main » (diff)
- Revue qualité **codebase** MonCoachScolaire / nexxustudio `src/`

## Quand NE PAS utiliser

- Snippet JSX/TSX collé sans chemin → `CODE_REVIEW_V1_1` (`codeReviewPolicy.js`)
- « C'est quoi useEffect » → G40 code explain
- Critique méta conversationnelle → G44/G46
- Tests E2E navigateur → `webapp-testing` (Playwright)
- **Fichier HTML/PHP/JS joint** (« audit sécurité », XSS, OWASP) → `attachmentTask=security_audit` + analyseurs `htmlAnalyzer` / `phpAnalyzer` / `jsAnalyzer` — **React Doctor ne lit pas un `.html` isolé**
- Audit sécu sans signal React/Vite/Next → hors G48

## Prérequis

- Racine projet avec `package.json` contenant `react`
- Node.js ≥ 18
- **Souveraineté** : `--no-telemetry --no-score` obligatoires ; `--json` pour parser ; `--offline` seulement si supporté localement

## Commande canonique

```powershell
cd "d:\Hostinger\public_html\nexxustudio"
npx -y react-doctor@latest . --json --verbose --yes --no-telemetry --no-score
```

### Variantes

```powershell
# Score seul
npx -y react-doctor@latest . --score --yes --offline --no-telemetry

# Diff vs main
npx -y react-doctor@latest . --diff main --verbose --yes --offline --no-telemetry

# Sous-projet (monorepo)
npx -y react-doctor@latest . --project web --verbose --yes --offline --no-telemetry
```

## Format de sortie Nexxus (obligatoire)

1. **Score** — `XX/100 (Grade)` + phrase de synthèse
2. **Top priorités** — max 5, tri severity (error > warning)
3. **Détail** — `fichier:ligne` — règle — message (uniquement depuis CLI)
4. **Prochaines étapes** — 2–3 actions concrètes
5. **Limites** — audit statique ; compléter avec Playwright si besoin runtime

## Rails autorisés

| `pipelinePath` | Plan |
|----------------|------|
| `react_audit_deterministic` | B |
| `react_audit_diff` | B |
| `react_audit_score` | B |
| `react_audit_clarify` | A |

## Interdits (forbidden_paths)

- `COMPOSER`
- `general_knowledge_full_pipeline`
- `semantic_intent_resolver`
- `presentation_outline`
- Web search sur ce tour

## Télémétrie Citadelle

Logger : intent, score, counts, duration, exit code.  
Ne **pas** logger : contenu source, messages diagnostic complets.

## Implémentation runtime (à venir)

Modules prévus :
- `reactAuditContractRouter.js`
- `reactAuditExecutionPolicy.js`
- `reactAuditPresentationPolicy.js`
- `reactAuditValidator.js`

Tests : `server/tests/react-audit-g48-routing.test.js`
