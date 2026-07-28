# Server Data Inventory

> **Mise à jour 2026-07-19 :** vagues 1–3, **4a**, **5** appliquées. Voir [storage-architecture.md](./storage-architecture.md).  
> `server/state/sessions` + `session-work-memory` hors `data/`.  
> **Reste :** vague 4b (telemetry/logs) puis 4c (reports/forge/document-analysis).

## Scope

Audit **uniquement** de `server/data` dans le workspace `nexxustudio`.

**Méthode :**
1. Inventaire arborescent disque (`Get-ChildItem` récursif + comptages par dossier).
2. Recherche de références dans `server/src`, `server/scripts`, `server/tests`, `package.json`, Docker.
3. Recoupement avec les modules `fs` / `path` / `readFile` / `writeFile` / `mkdir` / `ensureDir`.

**Non-objectifs (respectés) :** pas de modification de code, pas de déplacement de fichiers, pas de refactor avant classification.

**Limite :** ~1009 fichiers sous `server/data` (surtout `telemetry/*.json` et `session-work-memory/*.json`). La matrice ci-dessous décrit les **dossiers et fichiers racine importants**, pas chaque artefact horodaté.

**Légende catégories :**
- `DATA_PERSISTENT` — source de vérité applicative
- `CACHE_REGENERABLE` — dérivé reconstructible
- `STATE_RUNTIME` — état de session / travail en cours
- `LOGS_OBSERVABILITY` — observabilité / métriques / historiques
- `CONFIG_LOCAL` — configuration locale chargée au runtime
- `TEST_FIXTURE` — scénarios / sondes d’évaluation
- `GENERATED_REPORT` — rapports générés par scripts
- `UNKNOWN` — présent sur disque, **aucune preuve d’usage** dans le code applicatif actuel

---

## Current Tree

```
server/data/
├── agents/                          # 4 × *.agent.md (IDE-like)
├── chroma/                          # chroma.sqlite3 + collection UUID/
├── config/
│   ├── executionBrief.trigger-matrix.json
│   └── warmup.matrix.json
├── conversation/
│   ├── health-daily.jsonl
│   ├── health-incidents.jsonl
│   ├── quality-gate-history.jsonl
│   └── reports/
├── document-analysis/
│   ├── documents/                   # uploads + meta + last-analysis
│   └── sessions/                    # turn_*.json
├── drafts/                          # VIDE (0 fichier)
├── experts/                         # 13 × profils JSON experts
├── fixtures/
│   ├── persona_probes.json
│   └── scenarios.json
├── governance/
│   └── Certification_Checklist.json
├── intent-triage/
│   ├── clarification-feedback.jsonl
│   └── reports/
├── knowledge-hub/
│   └── knowledge_records.json
├── logs/
│   └── reliability/                 # 71 fichiers logs
├── mcp/
│   └── servers/
│       ├── citadelle-echo-mcp.json
│       └── echo-server.js
├── memory/
│   ├── drafts/                      # 107 fichiers
│   ├── episodic/
│   ├── governance/                  # events / daily jsonl
│   ├── procedural/
│   ├── projects/
│   │   └── workspace_index.json
│   ├── semantic/
│   └── manifest.json
├── ops/
│   └── reports/
├── reports/                         # report_*.json, scenarios_*.json
├── security/
│   └── audit-history.jsonl
├── session-work-memory/             # ~199 × {sessionId}.json (+ évent. episodes/candidates)
├── sessions/                        # 13 × {sessionId}.json
├── skills/                          # ~34 skill-* + SKILLS.md (~103 fichiers)
├── telemetry/                       # ~434 × session-*.json / agent-*.json + thermal_metrics.json
├── experts_cache.json
├── forge_jobs.json
├── projects_index.json
├── session_owners.json              # ORPHELIN (aucune ref code actuelle)
└── telemetry_metrics.json
```

**Chemins codés mais absents du disque au moment de l’audit** (créés à la première écriture) :
- `server/data/reliability/` (`ground_truth.json`, `log_index.json`) — `groundTruthService.js`
- `server/data/video-uploads/` — `videoUploadService.js`
- `server/data/micro/lexicon/` — `lexiconLearningStore.js`
- `server/data/memory/web-candidates/` — `candidateKnowledgeStore.js`

---

## Role Matrix

| Path | Type | Current Role | Evidence in Code | Category | Confidence | Delete Risk | Suggested Home | Notes |
|------|------|--------------|------------------|----------|------------|-------------|----------------|-------|
| `server/data/skills/` | dir | Catalogue runtime des skills agent (meta.json, SKILL.md, checklists) | `skillLoader.js`, `skillRuntimeRegistry.js`, `sync-vault-skills.js`, `tests/ci/validate_skill_runtime.js`, `pdf-extractor.js` | DATA_PERSISTENT | HIGH | HIGH | rester dans `server/data` (ou `server/skills` dédié) | Source de vérité plateforme ; distinct des skills IDE `.agents/` |
| `server/data/experts/` | dir | Définitions JSON des experts routés | `expertRouter.js` (`expertsDir`), `scripts/ingest_initial_lot.js` | DATA_PERSISTENT | HIGH | HIGH | rester / ou `server/config/experts` | Lecture obligatoire au boot router |
| `server/data/experts_cache.json` | file | Cache BM25/embeddings dérivé des experts | `expertRouter.js` (`cachePath` read/write) | CACHE_REGENERABLE | HIGH | LOW | `server/cache` | Reconstructible depuis `experts/` |
| `server/data/config/executionBrief.trigger-matrix.json` | file | Matrice de déclenchement Execution Brief | `executionBriefPolicy.js` (`readFileSync`) | CONFIG_LOCAL | HIGH | HIGH | `server/config` | Config versionnable |
| `server/data/config/warmup.matrix.json` | file | Matrice warmup modèles Ollama | `warmupService.js`, `ollama.js`, `tests/warmup-matrix.test.js` | CONFIG_LOCAL | HIGH | HIGH | `server/config` | Config versionnable |
| `server/data/mcp/servers/` | dir | Manifests + serveur echo MCP | `mcp-bridge.js`, `networkEgressPolicy.js`, `tests/mcp-bridge.test.js` | CONFIG_LOCAL | HIGH | MEDIUM | `server/config/mcp` | Pas d’écriture runtime observée |
| `server/data/memory/` | dir | Racine mémoire long terme (manifest, épisodes, procédural, sémantique, projets) | `MemoryOrchestrator.js`, `PrincipleConsolidator.js`, `workspaceIndexer.js`, `indexer/*` | DATA_PERSISTENT | HIGH | HIGH | rester dans `server/data/memory` | Cœur LTM |
| `server/data/memory/manifest.json` | file | Manifest d’indexation workspace | `indexer/workspaceIndexer.js` → `ManifestStore` | DATA_PERSISTENT | HIGH | HIGH | rester | |
| `server/data/memory/projects/workspace_index.json` | file | Index vectoriel/texte du workspace | `workspaceIndexer.js`, `citadel_indexer.js`, `impactAuditModule` (via index) | CACHE_REGENERABLE | HIGH | MEDIUM | `server/cache` ou rester sous memory | Régénérable par indexer ; volumineux |
| `server/data/memory/drafts/` | dir | Brouillons mémoire avant consolidation | `MemoryOrchestrator.js`, `scripts/consolidate.js` | STATE_RUNTIME | HIGH | MEDIUM | `server/state/memory-drafts` | ≠ `data/drafts/` top-level |
| `server/data/memory/governance/` | dir | Journal gouvernance mémoire (jsonl) | `memoryGovernancePersistor.js` | LOGS_OBSERVABILITY | HIGH | MEDIUM | `server/state/logs` ou rester | |
| `server/data/memory/episodic/` | dir | Mémoire épisodique persistée | `MemoryOrchestrator.js`, `memoryPromotionService.js` | DATA_PERSISTENT | HIGH | HIGH | rester | |
| `server/data/memory/procedural/` | dir | Mémoire procédurale | idem + `memoryGovernanceMetrics.js` | DATA_PERSISTENT | HIGH | HIGH | rester | |
| `server/data/memory/semantic/` | dir | Taxonomie / faits sémantiques | `MemoryOrchestrator.js` | DATA_PERSISTENT | HIGH | HIGH | rester | |
| `server/data/chroma/` | dir | Store ChromaDB local (sqlite + collections) | `package.json` script `chroma --path server/data/chroma` ; Docker `knowledge_hub_docker-compose.yml` ; Node via `CHROMA_HOST/PORT` dans `knowledgeHub.js` | DATA_PERSISTENT | HIGH | HIGH | rester / `server/state/chroma` | Aucun JS ne lit `chroma.sqlite3` directement |
| `server/data/knowledge-hub/knowledge_records.json` | file | Registre des knowledge records | `knowledgeRecordStore.js` | DATA_PERSISTENT | HIGH | MEDIUM | rester sous knowledge-hub | |
| `server/data/sessions/` | dir | Persistance fichiers des sessions chat | `sessionStore.js` (read/write/ensureDir) ; scripts extract/migrate | STATE_RUNTIME | HIGH | HIGH | `server/state/sessions` | |
| `server/data/session-work-memory/` | dir | Mémoire de travail par session (`{uuid}.json`) | `sessionWorkMemory.js` ; `episodeRecorder.js` (`episodes.jsonl`) ; `candidateFactStore.js` (`candidate_facts.json`) | STATE_RUNTIME | HIGH | MEDIUM | `server/state/session-work-memory` | Beaucoup de fichiers runtime |
| `server/data/session_owners.json` | file | Ancien ownership browser↔session (supposé) | **Aucune référence** dans `server/src` actuel (`sessionAccessService.js` utilise la DB) | UNKNOWN | HIGH | NONE | archive ou supprimer après confirmation | Orphelin prouvé |
| `server/data/document-analysis/` | dir | Documents uploadés + analyses + tours de session | `documentStore.js` | STATE_RUNTIME / DATA_PERSISTENT | HIGH | HIGH | `server/state/document-analysis` | Mix artefacts utilisateur + meta |
| `server/data/telemetry/` | dir | Spans/sessions agent persistés + `thermal_metrics.json` | `telemetry-observability.js`, `thermalTelemetry.js`, tests pipeline telemetry | LOGS_OBSERVABILITY | HIGH | LOW | `server/state/telemetry` ou `logs/` | ~434 JSON ; rétention prévue (skill telemetry) |
| `server/data/telemetry_metrics.json` | file | Agrégats métriques évaluation | `run_eval_dashboard.mjs`, `sync_evaluation_dashboard.mjs` | LOGS_OBSERVABILITY | HIGH | LOW | avec telemetry | Racine `data/` ≠ sous-dossier `telemetry/` |
| `server/data/conversation/` | dir | Incidents santé conversation + quality-gate history | `conversationHealthPersistor.js` ; rapports JSON via `daily-conversation-health-report.js` | LOGS_OBSERVABILITY | HIGH | MEDIUM | `server/state/logs/conversation` | |
| `server/data/logs/reliability/` | dir | Logs fiabilité (écriture chiffrée) | `reliabilityLogger.js` ; lecture via `groundTruthService.js` | LOGS_OBSERVABILITY | HIGH | MEDIUM | rester sous logs | |
| `server/data/security/audit-history.jsonl` | file | Historique audit sécurité | `securityTelemetryService.js` ; `seed-security-audit-history.js` | LOGS_OBSERVABILITY | HIGH | MEDIUM | `server/state/logs/security` | |
| `server/data/intent-triage/` | dir | Feedback clarification + rapports golden | `intentTriageFeedbackRecorder.js`, `intentTriageGoldenPromotion.js`, `export-intent-triage-golden.js` | LOGS_OBSERVABILITY / DATA_PERSISTENT | HIGH | MEDIUM | `server/state/intent-triage` (+ export fixtures tests) | Feedback = apprentissage ; reports = générés |
| `server/data/ops/reports/` | dir | Rapports ops quotidiens JSON | `daily-ops-report.js` | GENERATED_REPORT | HIGH | LOW | `server/state/reports/ops` | |
| `server/data/reports/` | dir | Rapports eval / scenarios | `run_scenarios.js`, `run_eval.js` | GENERATED_REPORT | HIGH | LOW | `server/state/reports` | |
| `server/data/fixtures/` | dir | Scénarios & persona probes pour scripts eval | `run_scenarios.js`, `run_eval.js` | TEST_FIXTURE | HIGH | MEDIUM | `tests/fixtures` | Distinct de `server/tests/fixtures/` |
| `server/data/forge_jobs.json` | file | File / historique jobs Async Forge | `AsyncForgeService.js` | STATE_RUNTIME | HIGH | MEDIUM | `server/state/forge` | Contient stdout volumineux |
| `server/data/projects_index.json` | file | Index bibliothèque projets | `projectLibrary.js` | DATA_PERSISTENT / CACHE | HIGH | MEDIUM | rester ou `server/cache` | Confirmé R/W |
| `server/data/agents/` | dir | Définitions agents IDE (frontmatter planner/implementer/…) | **Aucune référence** runtime Node trouvée | UNKNOWN | HIGH | NONE→LOW | `.agents/` ou docs IDE | Ressemble à Copilot/Cursor agents, pas au loader skills |
| `server/data/drafts/` | dir | Dossier vide | **Aucune référence** (les drafts actifs = `memory/drafts`) | UNKNOWN | HIGH | NONE | supprimer ou documenter alias | Piège de naming |
| `server/data/governance/Certification_Checklist.json` | file | Checklist certification (statique) | **Aucune référence** code | UNKNOWN | HIGH | LOW | `docs/` ou vault Citadelle | Ne pas confondre avec `memory/governance/` |
| `server/data/reliability/` | dir (absent) | Ground truth + index logs (codé) | `groundTruthService.js` | DATA_PERSISTENT | HIGH | — | créer sous `server/data/reliability` ou `server/state/reliability` | Absent disque ; path actif |
| `server/data/video-uploads/` | dir (absent) | Uploads vidéo sécurisés | `videoUploadService.js` ; skill-nexxus-video | STATE_RUNTIME | HIGH | — | hors web root, ex. `server/state/uploads/video` | Absent jusqu’au 1er upload |
| `server/data/micro/lexicon/` | dir (absent) | Lexique appris micro | `lexiconLearningStore.js` | DATA_PERSISTENT | HIGH | — | `server/data/micro/lexicon` | Absent jusqu’à 1ère écriture |
| `server/data/memory/web-candidates/` | dir (absent) | Candidats knowledge web | `candidateKnowledgeStore.js` | STATE_RUNTIME | HIGH | — | sous memory | Absent jusqu’à 1ère écriture |

---

## Findings

1. **`server/data` est un fourre-tout fonctionnel** : config, skills, mémoire LTM, Chroma, sessions, télémétrie, fixtures eval et rapports cohabitent sans taxonomie unique.
2. **Deux “gouvernances” et deux “drafts”** : `data/governance` (orphelin) vs `data/memory/governance` (vivant) ; `data/drafts` (vide) vs `data/memory/drafts` (vivant).
3. **Skills runtime ≠ agents IDE** : `data/skills/` est branché au loader ; `data/agents/*.agent.md` n’a **aucune** preuve d’usage Node.
4. **`session_owners.json` est orphelin** : ownership sessions passé par la DB (`sessionAccessService.js` + repository), fichier JSON encore présent.
5. **Caches et sources mélangés** : `experts_cache.json` et `workspace_index.json` sont régénérables mais stockés à côté des sources de vérité.
6. **Observabilité dominante en volume** : `telemetry/` (~434) + `session-work-memory/` (~199) + `logs/` expliquent l’essentiel du nombre de fichiers.
7. **Plusieurs chemins “lazy-create”** absents du disque mais actifs dans le code (`reliability/`, `video-uploads/`, `micro/lexicon/`, `memory/web-candidates/`).
8. **Chroma** est persisté via CLI/Docker sur `server/data/chroma` ; le Node ne touche que le réseau (`knowledgeHub.js`).
9. **Fixtures dupliquées conceptuellement** : `server/data/fixtures` (scripts eval) vs `server/tests/fixtures` (tests unitaires).

---

## Proposed Taxonomy

### Rester dans `data` (sources de vérité applicatives)
- `skills/`
- `experts/` (profils, pas le cache)
- `memory/{episodic,procedural,semantic,manifest}` (+ éventuellement `knowledge-hub/`)
- `chroma/` (store vectoriel local) *ou* sous `state/chroma` si on réserve `data` au versionnable

### `server/config` (versionnable, lecture seule runtime)
- `config/executionBrief.trigger-matrix.json`
- `config/warmup.matrix.json`
- `mcp/servers/`

### `server/cache` (reconstructible)
- `experts_cache.json`
- `memory/projects/workspace_index.json` (et index dérivés)
- éventuellement `projects_index.json` si purement dérivé

### `server/state` / `logs` / `telemetry` (runtime + observabilité)
- `sessions/`, `session-work-memory/`, `document-analysis/`, `forge_jobs.json`
- `telemetry/`, `telemetry_metrics.json`, `conversation/`, `logs/`, `security/`, `ops/reports/`, `reports/`
- `intent-triage/` (feedback + reports)
- `video-uploads/`, `memory/drafts/`, `memory/web-candidates/`

### `tests/fixtures` (ou `server/tests/fixtures`)
- `fixtures/scenarios.json`, `fixtures/persona_probes.json`

### Hors `data` / à clarifier
- `agents/*.agent.md` → tooling IDE (`.agents/` / docs)
- `governance/Certification_Checklist.json` → vault / docs ops
- `session_owners.json`, `drafts/` vide → archive ou suppression après validation humaine

---

## Migration Notes

| Élément | Pourquoi mal placé | Cible | Difficulté |
|---------|--------------------|-------|------------|
| `data/config/*` | Config versionnable dans un dossier “data” mélangé au runtime | `server/config/` | **Facile** — 3–4 chemins hardcodés à mettre à jour |
| `data/mcp/servers` | Config MCP, pas donnée métier | `server/config/mcp` | **Facile** |
| `experts_cache.json` | Cache dérivé à côté des experts source | `server/cache/experts_cache.json` | **Facile** |
| `telemetry/`, `telemetry_metrics.json` | Observabilité pure | `server/state/telemetry` | **Moyen** — volume + scripts dashboard |
| `conversation/`, `logs/`, `security/`, `ops/reports`, `reports/` | Logs/rapports | `server/state/logs|reports` | **Moyen** |
| `sessions/`, `session-work-memory/` | État runtime | `server/state/...` | **Moyen** — chemins session critiques |
| `document-analysis/` | État + artefacts user | `server/state/document-analysis` | **Moyen** |
| `fixtures/` | Fixtures eval | `tests/fixtures` ou `server/tests/fixtures` | **Facile** |
| `workspace_index.json` | Index régénérable | `server/cache` | **Moyen** — indexers + impact tools |
| `agents/` | Pas branché runtime | tooling IDE / archive | **Facile** (si confirmé inutilisé) |
| `governance/Certification_Checklist.json` | Doc ops non référencée | vault Citadelle / docs | **Facile** |
| `session_owners.json` | Orphelin post-migration DB | supprimer ou archive | **Facile** mais **délicat** si vieux clients (vérifier prod) |
| `drafts/` (vide) | Homonyme trompeur de `memory/drafts` | supprimer | **Facile** |
| `chroma/` | OK en data ou state ; aujourd’hui cohérent avec CLI | optionnel `server/state/chroma` | **Délicat** — Docker + npm script + volume |
| `skills/` | Pourrait être `server/skills` mais OK en data | rester ou rename | **Délicat** — nombreux lecteurs + CI |

**Recommandation de séquence (quand migration autorisée) :**
1. Orphelins documentés (`session_owners`, `drafts` vide, `agents`, checklist) — faible risque.
2. Config (`config/`, `mcp`) — gains clarté immédiats.
3. Caches (`experts_cache`, index) — isolés.
4. Observabilité / state — plus de chemins, faire en lot versionné.

---

## Code files most important to understand `server/data`

| Fichier | Pourquoi |
|---------|----------|
| `server/src/agent/utils/skillLoader.js` / `skillRuntimeRegistry.js` | Racine `data/skills` |
| `server/src/agent/router/expertRouter.js` | `experts/` + `experts_cache.json` |
| `server/src/agent/memory/MemoryOrchestrator.js` | Racine `data/memory` |
| `server/src/indexer/workspaceIndexer.js` | `manifest.json` + `workspace_index.json` |
| `server/src/services/sessionStore.js` | `data/sessions` |
| `server/src/agent/memory/sessionWorkMemory.js` | `session-work-memory` |
| `server/src/ops/telemetry-observability.js` | `data/telemetry` |
| `server/src/services/document-analysis/documentStore.js` | `document-analysis` |
| `server/src/mcp/mcp-bridge.js` | `data/mcp/servers` |
| `server/src/services/knowledgeHub.js` + `package.json` (`chroma`) | Persistance Chroma |
| `server/src/agent/telemetry/conversationHealthPersistor.js` | `data/conversation` |
| `server/src/forge/.../AsyncForgeService.js` (via `forge_jobs.json`) | Jobs forge |
| `server/src/services/projectLibrary.js` | `projects_index.json` |

---

*Inventaire produit le 2026-07-19 — basé sur l’état disque du workspace et les références code observées ; les absences d’usage sont marquées UNKNOWN, non “supposé inutilisé en prod distante non audité”.*
