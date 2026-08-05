# Cartographie — Décision amont (lot 1)

| Champ | Valeur |
|-------|--------|
| **Périmètre** | `micro/classifiers/` (focus `intentShortCircuit.js`), `config/`, `policies/routing/`, `policies/intent/` |
| **Chemin racine** | `server/src/agent/` |
| **Date de mise à jour** | 2026-08-05 |
| **Mode** | Lecture seule — cartographie structurelle (pas de refactor) |
| **Référence amont** | [`agent-front-doors.md`](./agent-front-doors.md) (lot 0) |
| **Lots suivants** | Lot 2 = conversation / qualification / social / epistemic — voir §8 |

Document de **référence** pour tout ce qui décide **avant** les chemins lourds (pipeline plein, experts, stages).  
Le wiring (`agent.js` / `agentPipeline.run`) et le fast path (`simpleFastPath`) restent décrits dans le lot 0 ; ici on cartographie **qui tranche**, **dans quel ordre**, et **où ça se chevauche**.

---

## 1. Articulation avec le lot 0

```
agent.js
  └─ agentPipeline.run                    [lot 0 — pipeline central]
        ├─ nexxusAgentCycle               [lot 0 — cycle cognitif]
        ├─ ★ décision amont (ce lot) ★
        │     intent + routing + config + short-circuit
        ├─ paths/simpleFastPath           [lot 0 — fast path]
        └─ pipeline plein / experts       [hors lots 0–1]
```

| Question | Répondue par |
|----------|----------------|
| Qui reçoit l’appel ? | Lot 0 — `agent.js` |
| Qui orchestre le tour ? | Lot 0 — `agentPipeline` |
| Qui **décide** stop / clarify / rail / contrat ? | **Lot 1 (ce doc)** |
| Qui exécute 1 LLM rapide ? | Lot 0 — `simpleFastPath` |
| Qui comprend la requête (cycle) ? | Lot 0 — `nexxusAgentCycle` → `policies/conversation` (détail lot 2) |

---

## 2. Quatre couches — distinction nette

| Couche | Où | Rôle | Sortie typique |
|--------|-----|------|----------------|
| **A. Classification rapide** | `micro/classifiers/` | Délestage déterministe **avant LLM** ; ordre de rails critique | `{ path, mode, reply? }` ou `null` |
| **B. Config de seuils / contrats** | `config/` | Modes de réponse, registre de contrats d’intent, bypass SIMPLE_FAST | Mode, contractId, prompts, enforcement |
| **C. Routing** | `policies/routing/` | Gates (clarify), décomposition, enrichissement, info-seeking, annotate cycle SC | Gate / policy hit / hints |
| **D. Intent** | `policies/intent/` | Just-intent, composition, familles, frames conversation/request | Évaluation structurée + stratégie |

**Règle de lecture :**  
- **Intent** = *quoi* (domaine, action, confiance).  
- **Routing** = *faut-il clarifier / enrichir / découper / forcer un rail*.  
- **Classifiers** = *stop maintenant avec une reply (ou defer)* — consomme A–D + beaucoup de domaines hors lot.  
- **Config** = *contrats et plafonds* appliqués après (et parfois pour bypasser) les rails.

---

## 3. Inventaire du périmètre

### 3.1 `micro/classifiers/`

| Fichier | ~LOC | Rôle |
|---------|-----:|------|
| **`intentShortCircuit.js`** | ~2300 | **Hub** `runConversationShortCircuit` — filet ordonné de rails |
| `conversationTurnClassifier.js` | ~380 | Familles G46 (social / ideation / meta / …) |
| `conversationTurnType.js` | ~110 | Types de tour auxiliaires |
| `semanticIntentResolver.js` | ~165 | Résolution sémantique (filet) |
| `subjectUnderstanding.js` | ~160 | Sujet / compréhension |
| `subjectClassifier.js` / `entitySubtypeClassifier.js` | ~10 | Stubs / leaf |

**API clé**

- `runConversationShortCircuit(query, options)` → hit ou `null`
- `classifyShortCircuitIntent(query, options)` → `{ matched, path }` (wrapper dry)

### 3.2 `config/`

| Fichier | ~LOC | Rôle |
|---------|-----:|------|
| **`intentContractRegistry.js`** | ~1130 | Registre contrats + `resolveIntentContract`, `shouldBypassSimpleFast`, web-skip |
| **`modeResponseContracts.js`** | ~970 | `RESPONSE_MODES`, prompts mode, `enforceModeContract` |
| `conversationStabilityChecklist.js` | ~50 | Checklist stabilité |
| `*.json` (code delivery / project light / python) | — | Contrats livraison code (périphérie lot 1) |

### 3.3 `policies/routing/`

| Fichier | Rôle concentré |
|---------|----------------|
| **`clarificationDecisionPolicy.js`** | Gate clarify (`resolveClarificationGate`, `evaluateClarificationDecision`) |
| **`requestDecompositionPolicy.js`** | Multi-unité / multi-segment (`decomposeRequest`, preempt) |
| **`shortCircuitCognitiveCyclePolicy.js`** | Annotation cycle sur hits SC (`annotateShortCircuitCognitiveCycle`) |
| `explicitWebSearchRequestPolicy.js` | Recherche web explicite / help SC |
| `informationSeeking*Policy.js` (3) | Qualification + light + orchestration IS |
| `knowledgeEnrichmentPolicy.js` + `generalKnowledgeEnrichmentPolicy.js` | Enrichissement / fraîcheur |
| `compareChooseCompositePolicy.js` | Comparer / choisir |
| `multiSegmentQualificationPolicy.js` | Qualif multi-segment |
| `practicalAdviceRoutingGuard.js` | Garde conseil pratique |
| `reactAudit*` | Audit React (router + SC) |
| `researchThenSummarizePolicy.js` | Research→summary |
| `index.js` | Barrel domaine |

### 3.4 `policies/intent/`

| Fichier | Rôle concentré |
|---------|----------------|
| **`justIntentDetectionPolicy.js`** | `evaluateJustIntent`, factual, domain/action |
| **`justIntentThresholds.js`** | Seuils longueur / clarify (calibration) |
| **`intentCompositionPolicy.js`** | `resolveIntentComposition` (post / parallèle) |
| `intentFamilyRegistry.js` | Familles d’intent catalogue |
| `intentCompatibilityMatrix.js` | Compatibilité entre intents |
| `requestIntentFrame.js` / `conversationIntentFrame.js` | Frames request vs conversation |
| `index.js` | Barrel domaine |

---

## 4. Flux de décision amont dans `agentPipeline.run`

Ordre **observé** (simplifié — phases décisionnelles avant / autour du SC) :

```
[lot 0] runAgentUnderstandingPhase / executionPlan
        │
        ├─ evaluateJustIntent                          [intent]
        ├─ evaluateConversationMove                    [conversation — lot 2]
        ├─ resolveClarificationGate(+ move authority)  [routing]
        ├─ resolveStrategyExecution                    [telemetry/strategy]
        │     … (éventuels early-return clarify / open_exploration)
        │
        ├─ classifyTurnForPipeline (pré-SC)            [conversation + classifiers]
        ├─ runConversationShortCircuit                 [classifiers ★]
        │     ├─ hit + reply  → souvent SIMPLE_FAST / INSTANT  [lot 0 path]
        │     └─ null / defer → suite
        │
        ├─ resolveIntentComposition                    [intent]
        ├─ shouldBypassSimpleFast / word-guard         [config + lot 0]
        └─ pipeline plein
```

**Point critique :** une partie de la décision (just-intent, clarify gate, conversation move) tourne **avant** le short-circuit ; le short-circuit **re-classifie** aussi la famille de tour (G46) en interne. Deux passes de « famille » proches dans le temps.

---

## 5. Classification rapide — `intentShortCircuit` (priorités)

En-tête du module + début de `runConversationShortCircuit` (ordre **critique** — chantier B) :

| # | Rail (exemples de paths) | Notes |
|---|--------------------------|--------|
| — | Early exits | `acknowledgment` ; `wantsAnalysis` → null ; `forgeProduction` → null ; memory recall → null |
| 0 | `external_calendar` / `current_web_fact` | Avant explicit web / G46 |
| 0b | `query_composite` / `web_project_scoping_*` | Avant idéation G46 |
| 0c | explicit web help | Avant G46 idéation |
| 1 | G46 turn family SC | Via `conversationTurnClassifier` |
| … | casual explain / info-seeking light | G49 |
| … | social pattern (avec skip ideation/work) | G35 — collision connue vs meta |
| … | guided choice | Après open_prompt |
| … | epistemic uncertainty | Avant clarify générique |
| … | (suite ~1.5k LOC) multi_unit, datetime, meta, procedures, code, summary, pedagogy, … | Voir commentaires P2 G11–G19 en tête de fichier |
| fin | multi_segment composite / null | Filet |

Chaque hit passe par `emit` = **sufficiency gate** + **`annotateShortCircuitCognitiveCycle`** (routing).

**Dépendances hors lot 1 (blast radius) :** social, meta, guided, code, summary, attachment, web (via utils/policies), micro/replies, continuity, interpreter, posture — le hub SC **n’est pas autonome**.

---

## 6. Bifurcations, collisions, doublons

### 6.1 Bifurcations structurantes

| Bifurcation | Décideur | Effet |
|-------------|----------|--------|
| Clarify vs answer | `resolveClarificationGate` (+ move authority) | Early path gate vs suite |
| Stop déterministe vs continuer | `runConversationShortCircuit` | Reply / defer / null |
| Bypass SIMPLE_FAST | `shouldBypassSimpleFast` (config) | Force pipeline plus lourd |
| Word-guard SIMPLE_FAST | `shouldRunWordGuardSimpleFast` (lot 0) | Fast path sans hit SC |
| Multi-unit vs multi-segment | `shouldPreemptMultiSegment` (routing) | Ordre dans SC |

### 6.2 Décide trop tôt

| Zone | Pourquoi |
|------|----------|
| Rails web/calendar en tête du SC | Correct pour fraîcheur, mais court-circuite d’autres lectures (idéation, meta) |
| Social pattern avant meta (ordre documenté) | Cause connue G41.1 (`meta` vs `social_composite`) — chantier B |
| Clarification gate avant SC | Peut clarifier alors qu’un rail SC aurait répondu — partiellement compensé par move authority |

### 6.3 Décide trop tard / à plusieurs endroits

| Signal | Où #1 | Où #2 | Risque |
|--------|-------|-------|--------|
| Famille de tour G46 | Pipeline pré-SC (`classifyTurnForPipeline`) | Dans SC (`classifyConversationTurnFamily` + resolve) | Double classif ; télémétrie dupliquée |
| Just-intent / factual | `evaluateJustIntent` (pipeline) | Re-tests dans SC / simpleFast flags | Divergence possible de seuils |
| Intent contract | `intentContractRegistry` | Forced ids dans hits SC (`forcedIntentContractId`) | Deux sources de vérité contrat |
| Composition d’intent | Après SC (`resolveIntentComposition`) | Décomposition avant SC (`decomposeRequest`) | Lecture « unités » vs « composition » non unifiée |
| Mode réponse | `modeResponseContracts` | Champ `mode` du hit SC | SC pose le mode ; enforcement ailleurs |

### 6.4 Doublons de responsabilité (structurels)

1. **Hub SC vs policies domaine** — beaucoup de `resolve*ShortCircuit` vivent hors `routing/` (social, meta, code…) ; routing n’est qu’une partie des rails.  
2. **Config vs intent** — seuils just-intent dans `justIntentThresholds` ; contrats/modes dans `config/` — OK sémantiquement, mais calibration dispersée.  
3. **`classifyShortCircuitIntent`** = rejoue tout le SC pour un path — utile tests, coûteux si abusé runtime.

---

## 7. Zones de couplage & risques

| ID | Risque | Gravité | Signal |
|----|--------|---------|--------|
| U1 | `intentShortCircuit.js` god-file (~2.3k) | Haute | Ordre des `if` = produit ; tout insert = collision potentielle |
| U2 | SC dépend de ~15 domaines hors lot | Haute | Impossible de « simplifier SC » sans carte des rails |
| U3 | Clarification + SC + just-intent | Haute | Trois décideurs successifs sur l’ambiguïté |
| U4 | Double classification G46 | Moyenne | Pipeline + SC |
| U5 | `intentContractRegistry` + forced ids SC | Moyenne | Contrats parallèles |
| U6 | Chantier B (ordre rails) | Doc déjà | `ARCHITECTURE_RULES` §4.6 — hors simplification structurelle lot 1 |

---

## 8. Pistes de simplification minimale (non implémentées)

1. **Geler l’ordre des rails** — table §5 maintenue ; tout nouveau rail = entrée doc + position explicite (pas d’insert silencieux).  
2. **Une seule classif G46 par tour** — calculer dans le pipeline, **passer** `classification` au SC (déjà partiellement fait via options) et supprimer le second `classifyConversationTurnFamily` interne si redondant.  
3. **Frontière intent → routing → SC** — règle doc : intent ne retourne jamais de `reply` ; routing décide gate ; SC seul émet path+reply. Auditer les exceptions.  
4. **Registre des paths SC** — fichier ou section « catalogue des `path:` » (généré ou tenu à la main) pour tests et collisions.  
5. **Ne pas découper le fichier SC en premier** — d’abord inventaire des rails + tests d’ordre (chantier B) ; extraction par **famille de rails** ensuite (web early / social / pedagogy…).  
6. **Config** — garder `modeResponseContracts` et `intentContractRegistry` stables ; toute simplification = documentation des `shouldBypass*` avant déplacement de code.  
7. **Lot 2** avant toucher conversation move / epistemic dans le détail (déjà appelés depuis pipeline + SC).

---

## 9. Handoff — lots suivants

| Lot | Périmètre | Dépend de |
|-----|-----------|-----------|
| **2** | `policies/conversation`, qualification, social, epistemic | Ce doc + lot 0 |
| **3** | `utils/*IntentGuards`, `genericGreetingGuards` | Lots 1–2 (beaucoup de guards appelés par SC) |
| **4+** | micro/replies, domain policies, exécution | Après stabilisation des rails |

---

## 10. Vérifs recommandées

| Vérif | Geste | Attendu |
|-------|--------|---------|
| Callers SC | Grep `runConversationShortCircuit` | Principalement `agentPipeline` + tests |
| Gate clarify | Grep `resolveClarificationGate` | Pipeline + tests clarification |
| Just-intent | Grep `evaluateJustIntent` | Pipeline + SC/tests |
| Bypass fast | Grep `shouldBypassSimpleFast` | Pipeline word-guard |
| Ordre rails | Relire en-tête `intentShortCircuit.js` + tests G41/G46/traffic | Aligné §5 / chantier B |
| Non-régression doc | Tailles ±15 % des hubs | Mettre à jour §3 |

Smoke ciblés (comportement, pas refactor) : social check-in ; factoid G49 ; clarify ambigu ; `recherche sur internet` ; idéation — vérifier le **path** télémétré.

---

## 11. Journal

| Date | Changement |
|------|------------|
| 2026-08-05 | Création lot 1 — cartographie décision amont |
