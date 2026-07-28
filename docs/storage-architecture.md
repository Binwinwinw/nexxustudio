# Storage Architecture — La Citadelle (server)

**Statut :** migration en cours (vagues 1–2 appliquées 2026-07-19)  
**Inventaire source :** [server-data-inventory.md](./server-data-inventory.md)

## Taxonomie cible

| Racine | Rôle | Contenu typique |
|--------|------|-----------------|
| `server/data/` | Sources de vérité applicatives | `skills/`, `experts/`, `memory/`, `knowledge-hub/`, `chroma/` |
| `server/config/` | Config versionnable | matrices warmup / executionBrief, `mcp/servers/`, modules JS config existants |
| `server/cache/` | Dérivés régénérables | `experts_cache.json`, `workspace_index.json` |
| `server/state/` | Runtime mutable | `sessions/`, `session-work-memory/` *(4a)* ; telemetry/logs *(4b à venir)* |
| `server/tests/fixtures/` | Fixtures eval/scripts | `scenarios.json`, `persona_probes.json`, golden corpora |
| `server/ide-agents/` | Agents IDE (non runtime) | `*.agent.md` |
| `docs/` | Documentation / archive | gouvernance, inventaires, archives orphelines |

## Vague 4a — faite (state sessions)

| Avant | Après |
|-------|--------|
| `server/data/sessions/` | `server/state/sessions/` |
| `server/data/session-work-memory/` | `server/state/session-work-memory/` |

**Code mis à jour :** `sessionStore.js`, `sessionWorkMemory.js`, `episodeRecorder.js`, `candidateFactStore.js`, `migrate_sessions.js`, `extract_golden_dataset.mjs`, `.gitignore`.

**Reste 4b/4c :** telemetry, logs, reports, forge, document-analysis, intent-triage.

## Vague 5 — faite (fixtures)

| Avant | Après |
|-------|--------|
| `server/data/fixtures/scenarios.json` | `server/tests/fixtures/scenarios.json` |
| `server/data/fixtures/persona_probes.json` | `server/tests/fixtures/persona_probes.json` |

**Code mis à jour :** `scripts/run_scenarios.js`, `scripts/run_eval.js`.

## Vague 3 — faite (cache)

| Avant | Après |
|-------|--------|
| `server/data/experts_cache.json` | `server/cache/experts_cache.json` |
| `server/data/memory/projects/workspace_index.json` | `server/cache/workspace_index.json` |

**Code mis à jour :** `expertRouter.js`, `server/index.js` (ImpactAnalyzer), `services/workspaceIndexer.js`, `indexer/workspaceIndexer.js`, `citadel_indexer.js`, `impactAuditModule.js`.

`server/data/experts/` (profils) et `server/data/memory/` (LTM) restent des **sources de vérité**.

## Vague 1 — faite (orphelins)

| Avant | Après |
|-------|--------|
| `server/data/drafts/` (vide) | **supprimé** |
| `server/data/session_owners.json` | `docs/archive/session_owners.json` + note |
| `server/data/agents/` | `server/ide-agents/` |
| `server/data/governance/Certification_Checklist.json` | `docs/governance/Certification_Checklist.json` |

## Vague 2 — faite (config)

| Avant | Après |
|-------|--------|
| `server/data/config/executionBrief.trigger-matrix.json` | `server/config/executionBrief.trigger-matrix.json` |
| `server/data/config/warmup.matrix.json` | `server/config/warmup.matrix.json` |
| `server/data/mcp/servers/` | `server/config/mcp/servers/` |

**Code mis à jour :** `executionBriefPolicy.js`, `warmupService.js`, `ollama.js`, `mcp-bridge.js`, `networkEgressPolicy.js`, `warmup-matrix.test.js`, `smoke-warmup-matrix.mjs`, `mcp-bridge.test.js`.

## Vagues suivantes (non appliquées)

4b. **Telemetry / logs / observability** → `server/state/telemetry`, `server/state/logs/...`  
4c. **Rapports générés / forge / document-analysis / intent-triage** → `server/state/...`

~~3. Cache~~ / ~~4a. Sessions~~ / ~~5. Fixtures~~ — **faits**.

## Checklist validation post-migration 4a

1. **Redémarrer** `npm run start` (chemins state chargés au boot).
2. Ouvrir le chat → créer / reprendre une session → vérifier un fichier sous `server/state/sessions/*.json`.
3. Envoyer un tour substantiel → vérifier `server/state/session-work-memory/<sessionId>.json`.
4. Confirmer absence de `server/data/sessions` et `server/data/session-work-memory`.
5. Smoke tests : `node --test tests/storage-state-sessions.test.js` + `tests/session-work-memory.test.js`.
6. Pas de régression ownership : sessions toujours via DB + fichiers state (pas `session_owners.json`).

## Règles

- Ne pas remettre de config versionnable sous `server/data/`.
- Ne pas confondre `server/data/skills/` (runtime) et `server/ide-agents/` (IDE).
- Les chemins absents mais codés (`reliability/`, `video-uploads/`, `micro/lexicon/`) seront créés sous `data/` ou `state/` selon la vague 4.
