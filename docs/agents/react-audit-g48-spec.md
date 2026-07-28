# G48 — React Audit (React Doctor) — Spec fonctionnelle

**État** : juillet 2026 — **spec esquissée** ; implémentation runtime **à faire**.

**Référence noyau** : [query-understanding-g29-spec.md](./query-understanding-g29-spec.md), `CODE_REVIEW_V1_1` (`codeReviewPolicy.js`)

**Outil externe** : [millionco/react-doctor](https://github.com/millionco/react-doctor) — CLI déterministe, score 0–100, diagnostics React/Next/Vite/RN.

**Modules cibles** (post-implémentation) :
- `server/src/agent/policies/reactAuditContractRouter.js` — classification `react_audit/*`
- `server/src/agent/policies/reactAuditExecutionPolicy.js` — invocation CLI + normalisation sortie
- `server/src/agent/policies/reactAuditPresentationPolicy.js` — enveloppe G41 (ton, priorisation)
- `server/src/agent/validators/reactAuditValidator.js` — invariants livrable
- `server/src/agent/telemetry/reactAuditTelemetry.js`

**Skill Citadelle** : `.agents/skills/react-doctor-audit/SKILL.md`

**Tests cibles** :
- `server/tests/react-audit-g48-routing.test.js` — détection + routage
- `server/tests/react-audit-g48-presentation.test.js` — contrat de présentation
- `server/scripts/smoke-react-audit-g48.mjs` — scan réel sur `src/` (optionnel CI)

**Voir aussi** :
- [nexxus-routing-behavior-registry-v1.md](./nexxus-routing-behavior-registry-v1.md) — pack G48 (à ajouter)

---

## Problème adressé

« Audite ce repo React » n'est pas une tâche unique. Sans contrat :

- Nexxus improvise une revue LLM (hallucinations, règles génériques),
- ou part en orchestrateur lourd (COMPOSER + web) sur une demande d'audit local,
- ou confond **revue de snippet collé** (`CODE_REVIEW_V1_1`) et **audit de codebase**.

**Règle centrale** : quand l'intent est `react_audit/repo_scan`, le **moteur d'audit** est React Doctor (déterministe) ; Nexxus **enveloppe** les findings (G41), il ne les invente pas.

---

## Doctrine

| Principe | Description |
|----------|-------------|
| **Déterministe d'abord** | Diagnostics = sortie CLI React Doctor ; LLM uniquement pour reformulation/priorisation si activé. |
| **Local souverain** | Scan sur disque local ; `--offline` + `--no-telemetry` obligatoires (pas de télémétrie Sentry Citadelle). |
| **Contrat avant heuristique** | `ReactAuditContract` JSON = interface inter-plans. |
| **Distinct de snippet review** | Snippet collé sans chemin repo → `CODE_REVIEW_V1_1` ; chemin/projet React → `REACT_AUDIT_V1`. |
| **Plan B terminal si possible** | Pas d'orchestrateur si le CLI suffit ; escalade Plan C seulement si `envelope=llm_summary` explicite. |
| **Invariant gravé** | `intent === react_audit/repo_scan` ⇒ `routing.forbidWebSearch === true` et `routing.forbidComposer === true` par défaut. |

---

## Famille d'intentions `react_audit/*`

| Intent | Exemple | Prérequis | Contract |
|--------|---------|-----------|----------|
| `react_audit/repo_scan` | « audite le repo React », « scan react-doctor sur ./src » | Racine projet détectée ou chemin explicite | `REACT_AUDIT_V1` |
| `react_audit/diff_scan` | « audite mes changements vs main » | Repo git + branche base | `REACT_AUDIT_V1` |
| `react_audit/score_only` | « quel est le score santé React » | Racine projet | `REACT_AUDIT_V1` |
| `react_audit/snippet_fallback` | snippet JSX collé sans chemin | Snippet dans le tour | `CODE_REVIEW_V1_1` (pas G48) |
| `react_audit/ambiguous` | « audite mon front » sans stack | Stack non confirmée | `CLARIFY_REACT_AUDIT` |

**Frontière avec G40** : « c'est quoi useEffect » → `code/explain` ; « mon useEffect est mal écrit dans App.tsx » + chemin → `react_audit/repo_scan`.

**Frontière avec G46** : « tu comprends mon code React ? » (méta) → `comprehension_proof` ; « audite mon code React » → `react_audit/repo_scan`.

---

## Schéma JSON — `ReactAuditContract`

```json
{
  "$schema": "react-audit-contract/v1",
  "family": "react_audit",
  "intent": "react_audit/repo_scan",
  "contract": "REACT_AUDIT_V1",
  "version": 1,

  "target": {
    "rootPath": "d:/Hostinger/public_html/nexxustudio",
    "workspaceProject": null,
    "framework": "vite",
    "reactVersion": null,
    "confidence": 0.88
  },

  "scan": {
    "mode": "full",
    "diffBase": null,
    "verbose": true,
    "scoreOnly": false,
    "offline": true,
    "noTelemetry": true,
    "cli": "npx -y react-doctor@latest"
  },

  "constraints": {
    "maxDiagnostics": 40,
    "severityFloor": "warning",
    "categories": ["state_effects", "performance", "architecture", "security", "accessibility"],
    "language": "fr"
  },

  "resolution": {
    "strategy": "react_doctor_cli",
    "reason": "explicit_react_audit_phrase + vite_root_detected"
  },

  "routing": {
    "plan": "B",
    "pipelinePath": "react_audit_deterministic",
    "mode": "SIMPLE_FAST",
    "triageIntent": "code_review",
    "forbidWebSearch": true,
    "forbidComposer": true,
    "forbidDocumentRequest": true,
    "envelope": "deterministic_presentation"
  },

  "clarification": {
    "needed": false,
    "question": null,
    "options": []
  }
}
```

### Champs obligatoires

| Champ | Type | Description |
|-------|------|-------------|
| `family` | `"react_audit"` | Famille registry |
| `intent` | string | Une des intents `react_audit/*` |
| `contract` | `"REACT_AUDIT_V1"` | Contrat orchestrateur |
| `target.rootPath` | string \| null | Racine scan ; `null` si clarify |
| `scan.offline` | boolean | **true** en prod Citadelle |
| `scan.noTelemetry` | boolean | **true** en prod Citadelle |
| `routing.pipelinePath` | string | `react_audit_deterministic` ou `react_audit_diff` |
| `routing.forbidComposer` | boolean | true par défaut |

---

## Détection (Plan A)

### Signaux positifs `react_audit/repo_scan`

- Phrases : `audite`, `audit`, `scanne`, `analyse le repo`, `revue react`, `santé react`, `react doctor`, `health score`
- Stack : `react`, `vite`, `next`, `jsx`, `tsx`, `composant`
- Contexte : chemin repo session (`sessionWorkMemory.filesSeen`), projet Forge, PJ `package.json`

### Signaux négatifs (exclusions)

- `isCodeReviewRequest` + snippet exécutable collé **sans** chemin → `CODE_REVIEW_V1_1`
- `technical_overview` pur (« c'est quoi React »)
- `debug_diagnostic` incident runtime (logs, stack trace prod)
- Famille G46 `comprehension_proof` / `ideation` sans mandat audit

### Résolution chemin racine

1. Chemin explicite dans la requête (`./src`, `d:\...\nexxustudio`)
2. `options.workspaceRoot` / racine session Forge
3. Heuristique `package.json` avec `react` en dependency depuis CWD agent
4. Sinon → `react_audit/ambiguous` + clarify une fois

---

## Exécution (Plan B)

### Commande canonique

```bash
npx -y react-doctor@latest "<rootPath>" --json --verbose --yes --no-telemetry --no-score
```

> **Flags invariants G48** : `--json`, `--no-telemetry`, `--no-score` (documentés).  
> `--offline` : optionnel — activer seulement après probe locale (`react-doctor --help`).  
> Ne pas utiliser `--offline` comme invariant dur en G48.1.

Variantes :

| Mode | Flags |
|------|-------|
| Diff PR | `--diff main` |
| Score seul | `--score` |
| Monorepo | `--project web,admin` |
| CI gate | `--fail-on=error --yes --no-ami` |

### Normalisation sortie → `ReactAuditResult`

```json
{
  "score": 82,
  "grade": "Good",
  "project": {
    "framework": "vite",
    "reactVersion": "19.x",
    "typescript": true
  },
  "diagnostics": [
    {
      "ruleId": "react-doctor/no-array-index-as-key",
      "severity": "warning",
      "category": "architecture",
      "file": "src/components/AsyncForgePanel.jsx",
      "line": 42,
      "message": "Array index used as key",
      "fixable": false
    }
  ],
  "counts": { "error": 0, "warning": 12, "info": 3 },
  "cliExitCode": 0,
  "durationMs": 8400
}
```

**Timeout** : 120 s par défaut ; 300 s monorepo. Échec CLI → fallback message structuré (pas LLM inventé).

---

## Présentation Nexxus (enveloppe G41)

Structure imposée `formatReactAuditPresentation()` :

1. **Score & verdict** — `82/100 (Good)` + 1 phrase située
2. **Top 5 priorités** — erreurs > warnings ; tri par impact (security, state_effects, a11y…)
3. **Détail par catégorie** — max `maxDiagnostics` entrées avec `fichier:ligne`
4. **Prochaines étapes** — 2–3 actions concrètes (pas de refactor massif non demandé)
5. **Limites** — rappel : audit statique React Doctor, pas substitute tests E2E (`webapp-testing`)

**Interdit en tête** :
- « Points clés du projet » générique
- findings inventés absents du JSON `diagnostics[]`
- orchestrateur / web search sur ce tour

---

## Routage & `pipelinePath`

| Intent | `pipelinePath` | Plan | LLM |
|--------|----------------|------|-----|
| `react_audit/repo_scan` | `react_audit_deterministic` | B | non (sauf envelope optionnelle) |
| `react_audit/diff_scan` | `react_audit_diff` | B | non |
| `react_audit/score_only` | `react_audit_score` | B | non |
| `react_audit/ambiguous` | `react_audit_clarify` | A | non |

### `forbidden_paths[]` (bloqués si contrat G48 actif)

- `COMPOSER`
- `general_knowledge_full_pipeline`
- `information_seeking_full_pipeline`
- `semantic_intent_resolver`
- `presentation_outline`
- `technical_overview` (sauf clarify stack)

### Position dans `intentShortCircuit`

Après `code_concept_*` et avant `technical_overview` :

1. `resolveReactAuditShortCircuit(query, { history, workspaceRoot })`
2. Si `ReactAuditContract.routing.plan === B` et CLI OK → retour direct
3. Sinon clarify ou fallback `CODE_REVIEW_V1_1` si snippet

---

## Télémétrie

| Signal | Usage |
|--------|-------|
| `react_audit.intent` | intent résolu |
| `react_audit.score` | score 0–100 |
| `react_audit.diagnostics_count` | volume |
| `react_audit.cli_duration_ms` | perf |
| `react_audit.cli_exit_code` | fiabilité |
| `react_audit.offline` | conformité souveraineté |

**Ne jamais logger** : contenu fichier, extraits de code, messages diagnostic complets (PII/code).

---

## Validator — invariants livrable

`reactAuditValidator.js` vérifie :

- [ ] Score présent si `scoreOnly` ou mode full
- [ ] Chaque finding cité dans la réponse existe dans `diagnostics[]`
- [ ] Aucune section « Points clés » avant priorités
- [ ] Pas de lien web arbitraire
- [ ] Nombre findings ≤ `maxDiagnostics`

Échec validator → retry présentation déterministe (pas orchestrateur).

---

## Cas de test (batterie G48)

| ID | Entrée | Historique | Intent attendu | `pipelinePath` | Interdit |
|----|--------|------------|----------------|----------------|----------|
| G48-T01 | « audite le repo react » | racine vite | `repo_scan` | `react_audit_deterministic` | COMPOSER |
| G48-T02 | snippet JSX collé 20 lignes | — | — | `CODE_REVIEW` path | react_doctor CLI |
| G48-T03 | « audite mes changements vs main » | git | `diff_scan` | `react_audit_diff` | web |
| G48-T04 | « quel est le score santé react » | racine | `score_only` | `react_audit_score` | verbose LLM |
| G48-T05 | « audite mon front » | ambigu | `ambiguous` | `react_audit_clarify` | scan |
| G48-T06 | « à quel moment tu comprends mon react » | méta | `comprehension_proof` | G45/G46 | G48 |
| G48-T07 | findings presentation | mock 12 warnings | — | validator pass | finding fantôme |

---

## Phases d'implémentation

| Phase | Livrable | Risque |
|-------|----------|--------|
| **G48.0** | Spec + skill + registry (ce document) | — |
| **G48.1** | Router + guards + short-circuit (ack routage) | **livrés** |
| **G48.2** | Exécution CLI réelle + normalisation JSON | à faire |
| **G48.3** | Présentation G41 + validator | faible |
| **G48.4** | Smoke sur `nexxustudio/src` + option CI `--diff` | faible |

---

## Changelog spec

| Date | Version | Changement |
|------|---------|------------|
| 2026-07-14 | v0.2 | G48.1 router + guards + short-circuit livrés |
