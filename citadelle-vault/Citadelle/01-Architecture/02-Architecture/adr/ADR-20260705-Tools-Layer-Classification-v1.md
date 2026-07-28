# ADR-20260705 : Tools Layer Classification v1

## Statut

**Accepté** (05/07/2026)

## Contexte

Le répertoire `server/src/tools/` regroupe huit modules historiques (build, scan, mémoire, web, vault, heuristiques locales). Un audit de traversée (imports, routes HTTP, UI Cockpit, `toolExecutor`, logs agent) montre que **tous ne participent pas au noyau vivant** de La Citadelle avec la même intensité.

Sans classification explicite, la surface mentale du dépôt mélange :
- modules **Core** (Forge, LTM, stage-gate mémoire),
- outils **agent-tool** (actions explicites `<action>`),
- briques **Latent** (doctrine valide, chaîne non raccordée),
- modules **Legacy** (environnement Hostinger ou heuristique non gouvernée).

La vérité opérationnelle doit venir de la **traversée observée**, pas de l'intention supposée du code.

## Décision

Adopter le registre **Tools Layer v1** suivant :

| Module | Statut | DoD minimal |
|--------|--------|-------------|
| `projectBuilder.js` | **Core** | Traversé Forge + API · smoke test build |
| `vaultManager.js` | **Core** | LTM + promote · `registerDocument` testé |
| `projectScanner.js` (tools) | **Core** | API `/scan` · gate promote · smoke score |
| `projectMemoryPromoter.js` | **Core** | Cockpit + API · gate ≥ 18 |
| `searchTool.js` | **Agent-tool** | Distinct d'`expertWebSearch` · smoke `webSearch` |
| `projectLibrary.js` | **Legacy-experimental** | Hors noyau · ADR-20260705-Tools-Layer-ProjectLibrary (Option B) |
| `workspaceScanner.js` | **Legacy-env** | Tag Hostinger · hors noyau AGENTS.md |
| `pulseEngine.js` | **Legacy-heur** | Tag experimental · hors gouvernance mémoire |

**Règle de gouvernance** :
- **Core** et **Agent-tool** = documentés, smoke-testés, appelables sans surprise.
- **Latent** = interdit au noyau AGENTS.md tant que non rebranché ou archivé.
- **Legacy** = isolé du chemin critique Forge / mémoire / chat.

**Note** : `server/src/forge/utils/projectScanner.js` est un module **distinct** de `server/src/tools/projectScanner.js` — ne pas fusionner sans ADR dédiée.

## Conséquences

- Les agents et la doc ne doivent pas présenter `projectLibrary`, `workspaceScanner` ou `pulseEngine` comme noyau vivant.
- Chaque module **Core** doit avoir au moins un smoke test avant la prochaine release Forge significative.
- Les nouveaux modules `server/src/tools/` entrent par défaut en **Latent** jusqu'à preuve de traversée + ADR ou amendement de cette classification.

## Validation

Registre considéré appliqué lorsque :
- ADR ProjectLibrary **Accepted — Option B** (2026-07-05).
- `registerInDashboard` est câblé sur `vaultManager.registerDocument` (P0 — ADR RegisterInDashboard ou patch runtime).
- [x] Au moins un smoke test existe pour `projectScanner.scanProjects()` et `vaultManager.registerDocument()`.

## Plan

| Priorité | Action |
|----------|--------|
| P0 | Câbler `registerInDashboard` → `registerDocument` (`vaultManager.js`) |
| P1 | ~~Trancher Option A ou B pour `projectLibrary`~~ — **Option B acceptée** |
| P2 | ~~Smoke tests Core~~ — `npm run test:tools-core` (`tools-core-smoke.test.js`) · tag Legacy dans commentaires `toolRegistry.js` |
| P3 | Après 30 j sans log `[ToolExecutor] pulse` / `workspaceSearch` → deprecate ou retirer du registre |

## Références

- Audit traversée : conversation agents / registre opérationnel v1 (2026-07-05)
- `server/src/agent/utils/toolExecutor.js` · `toolRegistry.js` · `server/index.js`
- ADR-20260705-Tools-Layer-ProjectLibrary.md
