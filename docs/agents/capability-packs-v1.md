# Capability packs v1 — Ponytail, Caveman, Graphify

**État** : proposition (2026-07-27) — à implémenter par phases.  
**Alignement** : [nexxus-routing-behavior-registry-v1.md](nexxus-routing-behavior-registry-v1.md) (Plans A/B/C, pas de 4ᵉ couche abstraite parallèle).

## Objectif

Traiter **Ponytail**, **Caveman** et **Graphify** comme des **modules portables** (behavior + tool), activés par **intent/contrat**, pas comme plugins IDE globaux.

| Pack | ID interne | Nature | Cible |
|------|------------|--------|--------|
| Ponytail | `behavior.ponytail` | Règles génération code (YAGNI, diff minimal) | Intents **code** |
| Caveman | `behavior.caveman` | Compression sortie / requêtes internes | Modes **frugaux** |
| Graphify | `tool.graphify` | Graphe structurel code (CLI / serveur) | Intents **architecture / impact** |
| OCR (Unlimited-OCR) | `tool.ocr` | Parsing document PDF/image (HTTP interne) | Intents **document / ingestion** |

**GitNexus** (déjà présent côté Cursor via `.agents/skills/gitnexus*`) joue le rôle **tool.graphify** dans l’atelier ; le runtime Nexxus peut l’envelopper ou coexister avec un binaire Graphify upstream selon déploiement.

---

## Prérequis Citadelle (audit juillet 2026)

| Condition | État actuel | Note |
|-----------|-------------|------|
| Profils / policies par intent | **Oui** | `intentContractRegistry.js`, `chatAgentProfilePolicy.js`, `justIntentDetectionPolicy.js` |
| Injection règles avant LLM | **Oui** | `structuredRequestHint` (`buildPosturePromptAddon`, voice, attachments) ; `getModeSystemPrompt` ; addons composeur |
| Couche tools / experts | **Oui** | `SovereignOrchestrator`, `expert_web_search`, Forge, fichiers |
| Priorité entre comportements | **Partiel** | Posture + voix + mode ; pas encore de registre capability explicite |

**Verdict** : intégration **possible maintenant** via un registre fin ; **ne pas** activer les trois packs par défaut sur tous les tours.

---

## Emplacement code proposé

```
server/src/agent/capabilities/
  index.js                 # composeCapabilityContext()
  capabilityTypes.js       # CAPABILITY_IDS, phases
  ponytail/
    match.js
    instructions.js        # texte upstream (sync .cursor/rules/ponytail.mdc)
    manifest.json          # version upstream, url
  caveman/
    match.js
    instructions.js        # résumé SKILL caveman (comportement LLM)
    applyShrink.js         # wrap cavemanShrink.js (entrée/sortie)
  graphify/
    match.js
    registerTools.js       # spawn CLI ou délégation gitnexus MCP (host)
    manifest.json
```

**Principe** : source upstream conservée ; adaptateur Nexxus **mince** (`match` + `inject` + `tools`).

---

## Interface JS (contrat pack)

Chaque pack exporte :

```js
/** @typedef {{
 *   id: string,
 *   priority: number,
 *   phase: 'pre_llm' | 'post_llm' | 'tool',
 * }} CapabilityManifest */

/**
 * @param {CapabilityMatchInput} input
 * @returns {{ active: boolean, score?: number, why?: string[] }}
 */
export function match(input) {}

/**
 * @param {CapabilityMatchInput} input
 * @returns {string|null}  // bloc system/developer à concaténer
 */
export function injectInstructions(input) {}

/**
 * @param {CapabilityMatchInput} input
 * @returns {import('./capabilityTypes.js').RegisteredTool[]}
 */
export function registerTools(input) { return []; }
```

### `CapabilityMatchInput`

```js
{
  query: string,
  history: object[],
  intentContractId: string | null,
  justIntent: { domain, intent, strategy, codeIntentKind? },
  conversationMove: { family, move, pipelinePath? },
  responseMode: string,           // RESPONSE_MODES.*
  orchestratorMode: 'direct' | 'light' | 'full',
  cavemanLevel: 'NORMAL' | 'LITE' | 'FULL' | 'ULTRA',  // existant pipeline
  capabilities: object,           // flags chatAgentProfilePolicy
  attachments: unknown[],
}
```

### Composition (`index.js`)

```js
export function composeCapabilityContext(input) {
  const packs = [ponytail, caveman, graphify]
    .map((p) => ({ pack: p, hit: p.match(input) }))
    .filter(({ hit }) => hit.active)
    .sort((a, b) => a.pack.priority - b.pack.priority);

  return {
    instructionBlocks: packs.map(({ pack }) => pack.injectInstructions(input)).filter(Boolean),
    tools: packs.flatMap(({ pack }) => pack.registerTools(input)),
    telemetry: packs.map(({ pack, hit }) => ({ id: pack.id, why: hit.why })),
  };
}
```

**Point d’accroche unique** (Plan A, après `justIntent` + `intentContractId` connus) :

- Concaténer `instructionBlocks` dans le même flux que `structuredRequestHint` (`agentPipeline.js` ~L772).
- Exposer `telemetry` dans `pipelineTelemetryCtx.capability_packs`.
- Enregistrer les tools Graphify uniquement si `orchestratorMode === 'full'` et pack actif.

---

## Règles d’activation (mapping v1)

| Contexte | Ponytail | Caveman | Graphify |
|----------|----------|---------|----------|
| `codeIntent` / `CODE_*` / refactor / debug diagnostic code | **ON** | OFF | optionnel |
| `REPO_ANALYSIS`, architecture design, « impact », call flow | OFF | LITE | **ON** |
| `RESPONSE_MODES.INSTANT` / `SIMPLE_FAST`, social, phatic | OFF | OFF | OFF |
| `chat_fast`, triage low depth, `cavemanLevel !== NORMAL` | OFF | **ON** | OFF |
| Pédagogie, tableaux, `lexicon_science*`, GUIDED pédagogique | OFF | OFF | OFF |
| `GUIDED_PRODUCT_RECOMMENDATION`, web factual | OFF | LITE (interne) | OFF |
| Meta capabilities G47 | OFF | OFF | OFF |

### Détail `match` — Ponytail

Actif si **au moins un** :

- `justIntent.codeIntentKind` défini ;
- `intentContractId` ∈ `CODE_REVIEW`, `CODE_GENERATION`, `DEBUG_DIAGNOSTIC`, `REPO_ANALYSIS` (génération patch only — pas l’exploration seule) ;
- `capabilities.code === true` (`chatAgentProfilePolicy`) **et** pas `requiresGenerousComposerResponse`.

### Détail `match` — Caveman

Deux usages distincts (ne pas confondre) :

1. **Comportement LLM** (`injectInstructions`) : mode ultra-court explicite ou `cavemanLevel` ULTRA/FULL demandé par profil / env.
2. **Shrink mécanique** (existant) : `cavemanShrink.js` sur prompts experts, manifest store — **garder** ; le pack documente la frontière.

Caveman **instruction** OFF si :

- contrat pédagogique / `requiresGenerousComposerResponse` ;
- `conversationMove.family` ∈ `pedagogy`, `presentation`, `multi_segment_composite` avec table demandée.

### Détail `match` — Graphify

Actif si **au moins un** :

- `isRepoAnalysisRequest` ;
- `isArchitectureDesignIntent` ;
- requête match `/impact|blast radius|call flow|qui appelle|graphe|dépendances/i` **et** `capabilities.code` ou scope repo local.

`registerTools()` :

- `graphify_query`, `graphify_explain`, `graphify_path` (CLI) **ou**
- pont vers GitNexus MCP quand l’hôte est Cursor (hors runtime Node seul).

---

## Priorité et compatibilité Ponytail × Caveman

| Couche | Ponytail | Caveman |
|--------|----------|---------|
| **Solution technique** (code produit) | contraint | — |
| **Formulation utilisateur** | — | compresse |
| **Prompts internes / experts** | — | shrink existant |
| **Pédagogie / specs** | neutre | **interdit** instruction |

Ordre d’injection recommandé : **posture → voix → capability packs → contrat mode**.

Si les deux actifs : Ponytail d’abord (priority 20), Caveman ensuite (priority 30) — Caveman ne doit pas contredire « une check runnable » imposée par Ponytail.

---

## Adaptateurs hôte

| Hôte | Ponytail | Caveman | Graphify |
|------|----------|---------|----------|
| **Cursor** | `.cursor/rules/ponytail.mdc` (déjà) | skill caveman user | GitNexus MCP / Graphify CLI |
| **Runtime Nexxus** | `capabilities/ponytail/instructions.js` | `capabilities/caveman` + `cavemanShrink` | `registerTools` orchestrateur |

Pas de duplication de logique métier dans l’orchestrateur : le registre **compose** ; les policies existantes **matchent**.

---

## Phases d’implémentation

### P0 — Registre + Ponytail runtime (1 PR)

- Créer `capabilities/` + `composeCapabilityContext`.
- Brancher injection sur intents code uniquement.
- Tests : `match` table-driven (10 cas) ; pas de régression pédagogie / web.

**Livré (2026-07-27)** : `server/src/agent/capabilities/`, branchement `agentPipeline.js`, `tests/capability-packs-p0.test.js`.

### P1 — Graphify CLI (P1a)

- `graphify/graphifyCli.js`, `registerTools.js`, `graphifyPaths.js`
- Outils `graph_query`, `graph_path`, `graph_explain` + session `capabilityToolSession.js`
- **Livré (2026-07-27)** : `tests/capability-packs-p1.test.js`, handlers `toolExecutor.js`

### P2 — Caveman instruction lite

- `caveman/instructions.js` — formulation lite (pas full/ultra fragments)
- Activation : `cavemanLevel !== NORMAL` + contrat/signal technique ; exclusions pédagogie/support/code_explain/spec
- `detectCavemanLevel(query)` fusionné dans le pipeline
- **Livré (2026-07-27)** : `tests/capability-packs-p2.test.js`
- Env optionnel **`NEXXUS_LOW_TOKEN_MODE=1|true|yes|on`** → `resolvePipelineCavemanLevel` force **LITE** (garde-fous contrat inchangés)

### P0 — OCR micro-service + tool.ocr (2026-07-27)

- `ocr-service/` FastAPI (`/ocr/page`, `/ocr/document`, `/health`, `/capabilities`) — backend `stub` par défaut
- `server/src/agent/capabilities/ocr/` — client HTTP, match intent document, outils `ocr_page` / `ocr_document`
- Spec : [unlimited-ocr-integration-v1.md](./unlimited-ocr-integration-v1.md)
- Tests : `tests/capability-packs-ocr-p0.test.js`
- Env : **`OCR_SERVICE_URL`** (sans URL → pack off)

### P1 — Graphify / GitNexus tool gate

- `registerTools` + expert ou toolExecutor wrapper.
- Intents `REPO_ANALYSIS` / architecture seulement.
- Timeout + refus propre si index stale.

### P2 — Caveman instruction mode

- Séparer shrink mécanique (déjà) vs addon « réponse télégraphique ».
- Lier `cavemanLevel` pipeline à `match` caveman.

### P3 — Sync upstream

- Script ou doc « bump ponytail/caveman from upstream » (hash fichier).

---

## Télémétrie console

```
🧩 Capabilities : ponytail(code_edit) · caveman=off · graphify=off
```

Champs : `capability_packs[]` avec `{ id, active, why[] }` dans les steps orchestration.

---

## Anti-patterns

- Activer Ponytail sur `GUIDED_PRODUCT_RECOMMENDATION` ou chat social.
- Activer Caveman instruction sur contrats table / pédagogie.
- Lancer Graphify sans scope repo (question généraliste).
- Copier-coller les SKILL upstream dans dix fichiers orchestrateur — un seul `injectInstructions()` par pack.

---

## Références

- Ponytail : https://github.com/DietrichGebert/ponytail
- Caveman : skill utilisateur / `.agents/skills/caveman`
- Graphify : https://github.com (CLI query/path/explain — vérifier repo exact à l’implémentation P1)
- Nexxus : `server/src/agent/policies/chatAgentProfilePolicy.js`, `agentPipeline.js`, `server/src/utils/cavemanShrink.js`
