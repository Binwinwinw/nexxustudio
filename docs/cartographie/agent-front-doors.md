# Cartographie — Front doors agent (lot 0)

| Champ | Valeur |
|-------|--------|
| **Périmètre** | `agent.js`, `agentPipeline.js`, `orchestrator/runPipeline.js`, `nexxusAgentCycle.js`, `paths/simpleFastPath.js` |
| **Chemin racine** | `server/src/agent/` |
| **Date de mise à jour** | 2026-08-05 |
| **Mode** | Lecture seule — cartographie structurelle (pas de refactor) |
| **Lots suivants** | Lot 1 = décision amont (`micro/classifiers`, `config`, `policies/routing` + `intent`) — voir §7 |

Document de **référence**. Les lots suivants s’y rattachent ; toute évolution des portes d’entrée doit mettre à jour ce fichier (date + section touchée).

---

## 1. Vue d’ensemble — quatre natures

| Nature | Module | Rôle en une phrase |
|--------|--------|--------------------|
| **Wiring public** | `agent.js` | Façade exportée ; social déterministe léger ; délègue au pipeline (ou au diagnostic épistémique). |
| **Pipeline central** | `agentPipeline.js` | Orchestrateur unique du tour conversationnel (décision → short-circuit → fast path → plein). |
| **Cycle cognitif** | `nexxusAgentCycle.js` | Façade mince sur le cycle comprendre → workup → retrieval (source de vérité factorisée). |
| **Fast path** | `paths/simpleFastPath.js` | Exécution / livraison « un LLM » + enforcement de modes (post short-circuit ou word-guard). |
| **Pipeline épistémique** | `orchestrator/runPipeline.js` | Chaîne agents spécialisés (router → retrieval → … → render) — **hors** tour chat normal. |

```
Appels externes (routes, jobs, harness)
        │
        ▼
   agent.js  ──diagnostic:/audit:──►  orchestrator/runPipeline.js  ──► agents/*
        │
        └── défaut ──► agentPipeline.run()
                              │
                              ├─ nexxusAgentCycle.runAgentUnderstandingPhase()
                              ├─ micro/classifiers (short-circuit)     [hors lot 0]
                              ├─ paths/simpleFastPath (_runSimpleFastPath)
                              └─ stages / experts / orchestrator plein [hors lot 0]
```

---

## 2. Rôle de chaque front door

### 2.1 `agent.js` — wiring public

| | |
|---|---|
| **Responsabilité** | Point d’entrée singleton (`export default new Agent()`). Social déterministe **léger** (salutations, identité courte, architecture Citadelle). Branchement `diagnostic:` / `audit:` → `runPipeline`. Sinon → `AgentPipeline.run`. |
| **Entrées** | `run(query, history, options)` depuis routes/services/harness. |
| **Sorties** | Texte final (string) ; callbacks `onStep` / `onContent` / `onThought`. |
| **Ne doit pas** | Contenir vérité produit Studio/Forge (doctrine `ARCHITECTURE_RULES.md` §1) ; ni le short-circuit métier ; ni le cycle cognitif. |
| **Taille** | ~300 lignes · 6 imports |

**Dépendances directes**

| Import | Usage |
|--------|--------|
| `./agentPipeline.js` | Tour conversationnel par défaut |
| `./orchestrator/runPipeline.js` | Préfixe `diagnostic:` / `audit:` |
| `./utils/conversationGuards.js` | Exclusion status technique |
| `./utils/identityIntentGuards.js` | Réponse identité déterministe |
| `./micro/parsing/responseSufficiencyEvaluator.js` | Suffisance auto-reply |
| `./micro/parsing/multiSegmentResponsePlan.js` | Multi-segment → defer pipeline |

**Mélange observé** : logique sociale + liste de `technicalMarkers` + formatage markdown du diagnostic cohabitent dans le même fichier (wiring + contenu + branche épistémique).

---

### 2.2 `agentPipeline.js` — pipeline central

| | |
|---|---|
| **Responsabilité** | **God-orchestrator** du tour : mémoire session, décomposition, cycle cognitif, gates, short-circuit, SIMPLE_FAST, pipeline plein, livraison/contrats. |
| **Entrées** | `AgentPipeline.run(query, history, options)` (via `agent.js`). Injecte `getDeterministicSocialResponse` depuis `agent.js`. |
| **Sorties** | Texte via `_finalizePipelineTurn` / streaming ; télémétrie turn. |
| **Taille** | ~3300 lignes · ~90 imports — **blast radius maximal** |
| **API interne clé** | `run`, `_runSimpleFastPath`, `recoverVisibleResponse`, briefings/repairs experts |

**Dépendances directes (regroupées — pas exhaustif fichier par fichier)**

| Zone | Exemples d’usage dans le tour |
|------|-------------------------------|
| **Lot 0** | `nexxusAgentCycle`, `paths/simpleFastPath` |
| `micro/classifiers` | `runConversationShortCircuit`, triage/turn family |
| `policies/*` | routing, conversation, intent, code, document, delivery, posture, web, … |
| `config/` | `modeResponseContracts`, `intentContractRegistry` |
| `utils/` | guards, normalisation, fallbacks |
| `micro/replies` + `continuity` | composers, topic shift, document continuity |
| `telemetry/` | justIntent, conversation move shadow, summary, … |
| `capabilities/` | packs + caveman level |
| `memory/` | session work turn |
| `prompts/`, `harness/`, `router/` | briefing, control, experts |

**Ordre de phases (simplifié) dans `run()`**

1. Préparation (history, attachments, session work, fallbacks répétés)
2. Resume clarification pending (si applicable)
3. `decomposeRequest` + **`runAgentUnderstandingPhase`** (cycle cognitif)
4. Contrats / moves / enrichissement / gates (policies)
5. **`runConversationShortCircuit`** → souvent `_runSimpleFastPath` (origin `short_circuit`)
6. Sinon **word-guard SIMPLE_FAST** via `shouldRunWordGuardSimpleFast` → `_runSimpleFastPath`
7. Sinon pipeline plein (experts / stages / LLM)

**Mélange observé** : décision, exécution, télémétrie, recovery, et dizaines de domaines policies dans un seul module.

---

### 2.3 `nexxusAgentCycle.js` — cycle cognitif (façade)

| | |
|---|---|
| **Responsabilité** | Nommer et exposer le cycle unique Nexxus ; **pas** d’orchestration runtime lourde. |
| **Entrées** | `runAgentUnderstandingPhase(query, history, options)` ; réexports d’étapes. |
| **Sorties** | `{ understanding, cognitiveCycle }` ; constantes de rôles (`NEXXUS_COMPONENT_ROLES`). |
| **Taille** | ~70 lignes · **1** import domaine |

**Dépendance directe unique**

| Import | Rôle réel |
|--------|-----------|
| `policies/conversation/conversationQueryUnderstanding.js` | `understandQuery`, `buildRequestWorkup`, `buildCognitiveCycle`, `applyWorkupRetrievalGate` |

**Doctrine déclarée**

```
intent_assessment → evidence_requirement → retrieval_decision → response_commitment
```

Composants : `agent_core` / `capability` / `mouth` / `legacy_decider`.

**Appelant lot 0** : `agentPipeline.js` uniquement (au scan actuel).  
**Note** : le pipeline importe aussi `understandQuery` / plans via `policies/conversation` **en parallèle** — double surface d’entrée sur le même domaine.

---

### 2.4 `paths/simpleFastPath.js` — fast path

| | |
|---|---|
| **Responsabilité** | Chemin partagé SIMPLE_FAST : résolution de mode/flags, invoke LLM unique, pipeline de livraison + enforcements (how-to, factual, debug, math, translation…). |
| **Entrées** | Via `AgentPipeline._runSimpleFastPath` ; origines `SHORT_CIRCUIT` \| `WORD_GUARD`. |
| **Sorties** | Texte livré + métadonnées delivery (modes `RESPONSE_MODES`). |
| **Taille** | ~700 lignes · ~22 imports |

**Exports utiles**

- `SIMPLE_FAST_ORIGINS`
- `resolveSimpleFastResponseMode` / `resolveSimpleFastAllowRefusal` / `resolveSimpleFastIntentFlags`
- `applySimpleFastDeliveryPipeline`
- `invokeSimpleFastLlm`
- `shouldRunWordGuardSimpleFast`
- `resolveSimpleFastLocalCatchFallback`

**Dépendances directes (zones)**

| Zone | Usage |
|------|--------|
| `config/modeResponseContracts` | Modes + contracts |
| `policies/posture`, `math`, `qualification`, `code` | Manner, math SC, how-to, code concept |
| `utils/*IntentGuards` | Flags overview / debug / career / presentation… |
| `micro/replies` + `micro/parsing` | Composers + surface micro contract |

**Mélange observé** : détection de flags + invoke LLM + nombreux enforcements domaine dans le même module (exécuteur + mini-routeur de modes).

---

### 2.5 `orchestrator/runPipeline.js` — pipeline épistémique

| | |
|---|---|
| **Responsabilité** | Pipeline **vérifié** (envelope → router → retrieval → facts → synthesis → critic → verdict → render). Branche `quick_answer`. |
| **Entrées** | Envelope `{ query_id, user_query, context, constraints }` depuis `agent.js` (préfixe diagnostic/audit). |
| **Sorties** | `{ response_text, verdict_matrix, … }` |
| **Taille** | ~260 lignes · 12 imports |
| **Hors chemin chat** | Non appelé par le tour conversationnel normal de `agentPipeline`. |

**Dépendances directes**

| Import | Rôle |
|--------|------|
| `agents/*` | router, retrieval, factExtractor, synthesis, critic, verdict, quickAnswer, finalRenderer |
| `validators/pipelineValidators` | Envelope / evidence / facts / draft / final |
| `audit/auditTrail` | Trace |
| `./pipelineConfig` | Config locale |
| `services/criticObservabilityService` | Observabilité critic |

---

## 3. Flux d’appel simplifié

### 3.1 Tour conversationnel (chemin majoritaire)

```
caller → agent.run(query)
       → getDeterministicSocialResponse?  (injecté dans pipeline)
       → agentPipeline.run
            → runAgentUnderstandingPhase      [nexxusAgentCycle]
            → (gates / moves / contracts)     [policies — lot 1+]
            → runConversationShortCircuit     [micro — lot 1]
                 ├─ stop + reply déterministe
                 └─ path SIMPLE_FAST → _runSimpleFastPath → simpleFastPath.*
            → sinon word-guard SIMPLE_FAST → _runSimpleFastPath
            → sinon pipeline plein (experts / stages / LLM)
```

### 3.2 Diagnostic / audit

```
caller → agent.run("diagnostic:…"| "audit:…")
       → runPipeline(envelope)
       → agents spécialisés → finalRenderer
       → markdown formaté dans agent.js
```

### 3.3 Distinction wiring / cycle / fast / central / épistémique

| Couche | Qui décide d’y aller ? | Qui exécute ? |
|--------|------------------------|---------------|
| Wiring | Callers externes | `agent.js` |
| Cycle cognitif | Toujours tôt dans `agentPipeline.run` | `nexxusAgentCycle` → `conversationQueryUnderstanding` |
| Short-circuit | `agentPipeline` après amont | `intentShortCircuit` (**hors lot 0**) |
| Fast path | Short-circuit path ou word-guard | `simpleFastPath` via `_runSimpleFastPath` |
| Pipeline central (plein) | Fallback si pas de stop amont | reste de `agentPipeline` + stages/agents |
| Pipeline épistémique | Préfixe query dans `agent.js` | `runPipeline` |

---

## 4. Zones de couplage (lot 0)

| Lien | Type | Commentaire |
|------|------|-------------|
| `agent.js` → `agentPipeline` + `runPipeline` | Bifurcation | Deux runtimes sous une façade |
| `agentPipeline` → `nexxusAgentCycle` + `policies/conversation` | Double entrée | Cycle via façade **et** imports conversation directs |
| `agentPipeline` → `simpleFastPath` | Exécution | `_runSimpleFastPath` concentre flags + delivery |
| `agentPipeline` → ~90 modules | Hub | God-file ; tout lot amont touche ce fichier |
| `simpleFastPath` → utils + policies domaine | Large | Fast path sait trop de domaines |
| `agent.js` social ↔ pipeline short-circuit | Injection | `getDeterministicSocialResponse` passé au short-circuit |

---

## 5. Risques

| ID | Risque | Gravité | Signal |
|----|--------|---------|--------|
| R1 | `agentPipeline.js` god-file | Haute | ~3.3k LOC, ~90 imports — toute simplification locale risque régression transversale |
| R2 | Deux pipelines sous `agent.js` | Moyenne | Chat vs épistémique : contrats/validators différents ; confusion de responsabilités |
| R3 | Cycle cognitif « façade » vs imports parallèles | Moyenne | `nexxusAgentCycle` mince mais non seule porte vers `conversationQueryUnderstanding` |
| R4 | SIMPLE_FAST = mini-routeur | Moyenne | Flags domaine + LLM + enforcement dans `simpleFastPath` |
| R5 | Social déterministe dans `agent.js` | Basse→moyenne | Contenu + markers techniques ; doctrine AR §1 à respecter (pas d’ajout produit) |
| R6 | Chantier B (ordre short-circuits) | Hors lot 0 | Vit surtout dans `micro/classifiers` + policies routing — documenté ailleurs |

---

## 6. Pistes de simplification minimale (non implémentées)

Ordre de prudence : **documenter / extraire sans changer le comportement**.

1. **Ne pas découper `agentPipeline.run` en premier** — d’abord lot 1 (décision amont) pour stabiliser les contrats d’entrée du short-circuit.
2. **`nexxusAgentCycle` comme seule porte cycle** — faire converger les imports pipeline vers la façade (réexport) avant d’y ajouter de la logique.
3. **`agent.js`** — extraire (plus tard) `getDeterministicSocialResponse` + markers vers un module `micro`/`social` déjà existant ; garder `run()` comme switch 2 voies.
4. **`simpleFastPath`** — séparer mentalement (puis fichiers) : (a) résolution flags/mode, (b) `invokeSimpleFastLlm`, (c) `applySimpleFastDeliveryPipeline` — sans changer les signatures publiques.
5. **`runPipeline`** — laisser isolé ; ne pas fusionner avec le tour chat ; éventuellement renommer mentalement « epistemic pipeline » dans la doc des lots exécution.
6. **Mise à jour de ce fichier** à chaque lot qui touche une front door (date + § concerné).

---

## 7. Handoff — lots suivants

| Lot | Périmètre suggéré | Dépend de |
|-----|-------------------|-----------|
| **1** | `micro/classifiers` (`intentShortCircuit`), `config/`, `policies/routing` + `intent` | Lot 0 (ce doc) |
| **2** | `policies/conversation`, qualification, social, epistemic | Lot 1 |
| **3** | `utils/*IntentGuards`, `genericGreetingGuards` | Lots 1–2 |
| **4+** | micro replies, domain policies, exécution, feuilles | Voir canvas / audit global |

Référence audit global : canvas `agent-structure-map` + `server/ARCHITECTURE_RULES.md` §4 (policies).

---

## 8. Vérifs recommandées (sans bloquer la doc)

| Vérif | Commande / geste | Attendu |
|-------|------------------|---------|
| Import façade agent | Grep `from "…/agent/agent.js"` sous `server/src` | Callers = routes/jobs/harness/tests |
| Cycle | Grep `runAgentUnderstandingPhase` | Principalement `agentPipeline.js` |
| Fast path | Grep `simpleFastPath` / `_runSimpleFastPath` | Pipeline + évent. connector registry |
| Épistémique | Grep `runPipeline` depuis agent | Branche diagnostic/audit dans `agent.js` |
| Smoke manuel | Tour « salut » + tour factuel court + `diagnostic:…` | Social / SIMPLE_FAST / verdict matrix |
| Non-régression structurelle | Ce fichier toujours aligné tailles ±10 % | Sinon mettre à jour §2 |

---

## 9. Journal

| Date | Changement |
|------|------------|
| 2026-08-05 | Création lot 0 — cartographie front doors (référence initiale) |
