# ADR-20260609 : Gouvernance des hooks agentiques (v1)

**Date** : 09/06/2026  
**Statut** : ✅ Validé — Phases A–E livrées (P0 + Forge + Shell + Network + Post-hooks)  
**Expert** : Nexxus (Orchestration souveraine)  
**Module** : [[02-Architecture/modules/Privileged-Action-Gate|Privileged-Action-Gate]]

## Contexte

La Citadelle dispose de commandes conversationnelles (`/careful`, `/freeze`, `/read-only`, `/confirm`) et d'un passage unique P0 (`privilegedActionGate`) sur `toolExecutor` et `mcp-bridge`. Sans registre unifié, les garde-fous risquent de devenir redondants, bruyants ou contournables (ex. écritures Forge directes via `fs.writeFile`).

Les recommandations OWASP et les architectures de gouvernance agentique convergent sur : **least privilege**, **approval gates explicites**, **décisions déterministes runtime**, **audit append-only rejouable**.

## Décision

Adopter un modèle **un hook = une règle runtime** branchée sur un moment du cycle d'exécution, orchestrée par un **registre unique** et une **gate obligatoire**.

### Règle d'architecture non négociable

> **Aucune écriture fichier, exécution commande, appel HTTP/MCP ou effet de bord équivalent ne doit contourner `executePrivilegedAction`.**

Les canaux parallèles (Forge handlers, scripts ad hoc) doivent être raccordés en P1 (`artifactWriteHook`).

## Cycle de décision

```text
Action normalisée (mapToolInvocationToAction / mapMcpToolToAction)
    ↓
Enrichissement (id, timestamp, projectRoot, sessionId)
    ↓
Construction policy_snapshot (version + hooks actifs)
    ↓
Évaluation registre — ordre CRITICAL → HIGH → MEDIUM
    ↓
Verdict : ALLOW | DENY | REQUIRE_APPROVAL | ALLOW_WITH_CONSTRAINTS
    ↓
[DENY / REQUIRE_APPROVAL] → audit PRIVILEGED_ACTION_BLOCKED → stop (fail-closed)
    ↓
[ALLOW] → audit PRIVILEGED_ACTION_ALLOWED → exécution → audit COMPLETED
```

**Court-circuit** : arrêt immédiat au premier `DENY` ou `REQUIRE_APPROVAL`.

## Types de verdict

| Verdict | Sémantique | Effet runtime |
|---------|------------|---------------|
| `ALLOW` | Action conforme aux politiques actives | Exécution autorisée |
| `DENY` | Violation bloquante | Exécution refusée (fail-closed) |
| `REQUIRE_APPROVAL` | Action à impact élevé | Suspendue — approbation humaine requise |
| `ALLOW_WITH_CONSTRAINTS` | Autorisé avec résolution canonique de chemin, etc. | Exécution avec contraintes appliquées |

## Schéma du registre (`hookRegistry.js`)

```javascript
{
  id: "dangerousCommandHook",       // identifiant stable
  family: "pre_action",             // pre_action | confirmation | post_action | audit | session | data
  priority: "P0",                   // P0 | P1 | P2
  riskLevel: "CRITICAL",            // CRITICAL | HIGH | MEDIUM | LOW
  commands: ["/careful"],           // interrupteurs utilisateur (optionnel)
  triggers: ["command_execute"],    // types d'action concernés
  alwaysOn: false,                  // true = évalue sans commande active
  evaluate: (action, state) => Verdict
}
```

### Policy snapshot (rejouabilité)

Chaque décision d'audit embarque :

```json
{
  "policy_version": "1.0.0",
  "active_commands": ["/freeze", "/audit-strict"],
  "freeze_directory": "/path/workspace",
  "read_only_directories": [],
  "workspace_root": "/path/project",
  "audit_strict": true,
  "protect_secrets": true,
  "evaluated_at": "ISO-8601"
}
```

## Ordre d'évaluation (déterministe)

| Ordre | Hook | Risque | Mode |
|-------|------|--------|------|
| 1 | `sensitiveFilesHook` | CRITICAL | always-on (écriture) + `/protect-secrets` (lecture) |
| 2 | `dangerousCommandHook` | CRITICAL | `/careful` |
| 3 | `pathBoundaryHook` | HIGH | always-on (workspace) + `/freeze` + `/read-only` |
| 4 | `confirmationRequiredHook` | HIGH | `/confirm` |

Hooks P1/P2 documentés mais non évalués en Phase A.

## Matrice d'audit minimale

| Événement | Quand | Champs obligatoires |
|-----------|-------|---------------------|
| `PRIVILEGED_ACTION_BLOCKED` | DENY ou REQUIRE_APPROVAL | `actionId`, `type`, `hookId`, `verdict`, `reason`, `policy_snapshot`, `evaluation_trail` |
| `PRIVILEGED_ACTION_ALLOWED` | ALLOW pré-exécution | `actionId`, `type`, `policy_snapshot` |
| `PRIVILEGED_ACTION_COMPLETED` | Succès post-exécution | `actionId`, `type`, `duration_ms` |
| `PRIVILEGED_ACTION_FAILED` | Exception exécution | `actionId`, `error` |

Mode `/audit-strict` : journalise en plus le `evaluation_trail` complet sur ALLOW.

Chaîne append-only : `auditLogger` (RFC 8785, `chain_position`, `entry_hash`).

## Catalogue noyau (12 + 1 obligation)

### P0 (Phase A)

- `dangerousCommandHook` — `/careful`
- `pathBoundaryHook` — workspace + `/freeze` + `/read-only` + `realpath`
- `sensitiveFilesHook` — `/protect-secrets` + blocage écriture secrets (always-on)
- `confirmationRequiredHook` — `/confirm`
- `auditTrailHook` — `/audit-strict`

### P1 (Phase B)

- `artifactWriteHook` — obligation architecture (Forge → gate)
- `networkEgressHook` — `/no-network`
- `postEditSyntaxHook`, `postEditTestHook`, `gitPolicyHook`

### P2 (Phase C)

- `contextBudgetHook`, `autonomyModeHook`, `checkpointHook`, `responseRedactionHook`, `policyExplainerHook`

## Commandes utilisateur (Phase A)

| Commande | Hook |
|----------|------|
| `/careful` | `dangerousCommandHook` |
| `/freeze` | `pathBoundaryHook` |
| `/read-only` | `pathBoundaryHook` |
| `/confirm` | `confirmationRequiredHook` |
| `/protect-secrets` | `sensitiveFilesHook` |
| `/audit-strict` | `auditTrailHook` |

## Fichiers implémentés (Phase A)

| Fichier | Rôle |
|---------|------|
| `server/src/hooks/hookRegistry.js` | Registre + moteur d'évaluation |
| `server/src/hooks/pathBoundary.js` | Résolution canonique `realpath` |
| `server/src/hooks/securityHooks.js` | État politique + délégation registre |
| `server/src/hooks/privilegedActionGate.js` | Passage unique + audit enrichi |

## Phase B — artifactWriteHook (09/06/2026)

### Stratégie de migration Forge

1. **Writer unique** : `server/src/forge/utils/forgeArtifactWriter.js` — seul point d'écriture artefacts.
2. **Marquage action** : `source: "forge"`, `forgeArtifact: true` pour déclencher `artifactWriteHook`.
3. **Contrainte périmètre** : toute écriture Forge doit résider sous `projects/` (rejouable via `FORGE_ARTIFACTS_ROOT`).
4. **Propagation contexte** : `forgeStageRegistry` transmet `{ sessionId, stage }` à chaque handler.
5. **Handlers migrés** : `projectBootstrapHandler`, `devScaffoldHandler`, `architectHandler`, `qaScaffoldAuditHandler`, `qaBuildValidationHandler`.

## Phase C — Commandes shell et mkdir Forge (09/06/2026)

### Writer unique commandes

- `server/src/forge/utils/forgeShellRunner.js` — `runForgeCommand()` (seule entrée shell Forge).
- `shellRunner.js` — façade rétrocompatible vers `runForgeCommand`.

### Writer unique mkdir

- `ensureForgeProjectDirectory()` dans `forgeArtifactWriter.js`.
- `ensureProjectDir()` dans `projectPaths.js` délègue à la gate.

### shellRunnerHook (registre)

| Commande | Verdict | Condition |
|----------|---------|-----------|
| `npm install [--no-audit]` | ALLOW | cwd sous `projects/` + audit |
| `npm run build` | ALLOW | cwd sous `projects/` + audit |
| Toute autre commande | DENY | allowlist fail-closed |
| `rm -rf`, `git push --force`, etc. | DENY | `dangerousCommandHook` actif pour `source: forge` même sans `/careful` |

### Ordre d'évaluation Forge command

`dangerousCommandHook` (CRITICAL, forge always-on) → `shellRunnerHook` (HIGH, allowlist + cwd) → `confirmationRequiredHook` si `/confirm`.

## Phase D — Network egress via gate (09/06/2026)

### Composants

| Fichier | Rôle |
|---------|------|
| `server/src/security/ssrfProtection.js` | DNS resolve + blocklist IP + preflight URL |
| `server/src/hooks/networkEgressPolicy.js` | Allowlist domaines + rollout `NETWORK_EGRESS_MODE` |
| `networkEgressHook` (registre) | Évalue `http_request` et `mcp_tool` |

### Rollout progressif (`NETWORK_EGRESS_MODE`)

| Mode | Comportement |
|------|--------------|
| `allowlist` (défaut) | Domaines allowlistés → ALLOW ; inconnu → DENY |
| `llm_providers` | `webSearch` / `webSummarize` → DENY (providers LLM uniquement) |
| `strict` | Inconnu → DENY (pas de chemin approval) |
| `off` | Hook egress pass-through (tests uniquement) |

### Allowlist initiale

- `*.duckduckgo.com`, `registry.npmjs.org`, `*.github.com`
- `*.googleapis.com`, `*.gemini.google.com`
- Patterns `TRUSTED_DOMAIN_PATTERNS` (wikipedia, docs officiels, etc.)

### Mapping outils

| Outil | Verdict |
|-------|---------|
| `webSearch` | ALLOW si hôtes egress allowlistés + audit |
| `webSummarize` | ALLOW si domaine allowlist + SSRF DNS OK |
| URL inconnue | DENY (`allowlist`) ou REQUIRE_APPROVAL si `/confirm` |
| MCP local (`data/mcp/servers`) | ALLOW + audit |
| MCP externe | DENY ou REQUIRE_APPROVAL si `/confirm` |
| `/no-network` | DENY tout egress HTTP/MCP |

### Audit réseau

Événements enrichis : `hostname`, `hook_id: networkEgressHook`, `policy_snapshot`, SSRF preflight dans `PRIVILEGED_ACTION_BLOCKED`.

`policy_version` registre : **1.1.0**

## Phase E — Post-hooks ciblés (09/06/2026)

### Cycle post-écriture

```text
file_write exécuté
    ↓
postEditSyntaxHook (E1 — always-on sauf POST_EDIT_SYNTAX=off)
    ↓
[échec] → PRIVILEGED_ACTION_POST_BLOCKED (fichier déjà écrit)
    ↓
postEditTestHook (E2 — targeted ou /test-required)
    ↓
PRIVILEGED_ACTION_POST_OK → PRIVILEGED_ACTION_COMPLETED
```

### Validateurs syntaxe (`syntaxValidator.js`)

| Extension | Validateur |
|-----------|------------|
| `.json` | `JSON.parse` |
| `.py` | `python -m py_compile` |
| `.js/.ts/.jsx/.tsx` | `eslint --no-eslintrc` |
| `.php` | `php -l` (skip si indisponible) |
| `.yml/.yaml` | `yamllint` (skip si indisponible) |

### Tests ciblés (`testRunner.js`)

| Mode | Déclenchement |
|------|---------------|
| `targeted` (défaut) | `src/`, `lib/`, `*.test.*`, `projects/**/*.py` |
| `full` | `/test-required` ou `POST_EDIT_TESTS=full` |
| `off` | `POST_EDIT_TESTS=off` |

### Commande

- `/test-required` — active `postEditTestHook` en mode full

`policy_version` registre : **1.2.0**

### Gap résiduel

- Redirect chain SSRF complète dans `axios`.
- `tsc --noEmit` global (option Phase E+).
- Session / redaction hooks (P2).

## Conséquences

- **Positives** : décisions rejouables, surface de test réduite, un seul point d'extension pour nouveaux hooks.
- **Négatives** : latence marginale (évaluation synchrone) ; confirmation UI toujours absente (fail-closed P0).
- **Risque résiduel** : commandes shell Forge (`npm install`, `npm run build`) hors gate — Phase B+.

## Références

- [[ADR-005-Sovereign-Safety-Governance]]
- [[ADR-004-Security-Hardening]]
- OWASP Agentic AI — least privilege, tool governance, human approval, audit logging
