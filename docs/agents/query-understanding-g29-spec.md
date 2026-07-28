# G29 — Query Understanding — Spec fonctionnelle

Référence opérationnelle pour la couche transversale de compréhension de requête.
G28 (math composite) est un **cas particulier** de G29.

**État** : juillet 2026 — lots G29.1 → G32 + G37 livrés ; **G38 spec figée** (implémentation planifiée) ; G30.2–G30.6 en gap documenté.

**Modules** :
- `server/src/agent/policies/conversationQueryUnderstanding.js` — noyau `understandQuery()` / `buildExecutionPlan()`
- `server/src/agent/policies/queryUnderstandingDomainRegistry.js` — registre détecteurs par segment
- `server/src/agent/policies/queryUnderstandingCoverageMatrix.js` — matrice G30 (régression)
- `server/src/agent/policies/mathCompositeQueryPolicy.js` — détecteurs math (branche G28)
- `server/src/agent/policies/governanceExplainPolicy.js` — G29.1
- `server/src/agent/policies/documentAnalysisCompositePolicy.js` — G29.2
- `server/src/agent/policies/documentSynthesisCompositePolicy.js` — G30.1 / G32.1
- `server/src/agent/policies/compareChooseCompositePolicy.js` — G31.1/2
- `server/src/agent/policies/guidedProductRecommendationPolicy.js` — G31.3
- `server/src/agent/policies/productRecoValidator.js` — G31.4
- `server/src/agent/policies/guidedDocumentSynthesisPolicy.js` — G32.3
- `server/src/agent/policies/documentSynthesisValidator.js` — G32.4
- `server/src/agent/policies/culturalContentSummaryPolicy.js` — G37 (détecteur `known_entity`)
- `server/src/agent/policies/summaryContractRouter.js` — **G38** (planifié)
- `server/src/agent/telemetry/strategyExecutionTelemetry.js` — triplet stratégie G31+
- `server/src/agent/config/intentContractRegistry.js` — contrats `GUIDED_*`

**Voir aussi** : [conversation-move-governance.md](conversation-move-governance.md) (fiches G28–G32), [query-understanding-g30-coverage-spec.md](./query-understanding-g30-coverage-spec.md) (matrice), [summary-contract-g38-spec.md](./summary-contract-g38-spec.md) (contrat `summary/*`), [intent-frame-and-decomposition.md](intent-frame-and-decomposition.md) (IntentFrame amont).

**Vault (ADRs)** :
- [ADR-20260627-Query-Understanding-G29-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260627-Query-Understanding-G29-v1.md)
- [ADR-20260627-Guided-Product-Recommendation-G31-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260627-Guided-Product-Recommendation-G31-v1.md)
- [ADR-20260627-Guided-Document-Synthesis-G32-v1](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/adr/ADR-20260627-Guided-Document-Synthesis-G32-v1.md)
- [Module Query Understanding G29](../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/modules/Query-Understanding-G29.md)

## Doctrine

> L'architecture pense le mouvement. Le pipeline pense la famille. Le LLM produit sous contrat.

**G29 ajoute** : avant le mouvement et avant la famille, Nexxus **lit la requête**.

| Avant G29 | Avec G29 |
|-----------|----------|
| « Cette phrase ressemble à un pattern » | « Cette demande contient N sous-buts » |
| Premier couloir fort gagné | Plan d'exécution gouverné |
| Pattern = primitive de gouvernance | Pattern = signal parmi d'autres |

---

## Entrée / sortie

### Entrée

| Champ | Type | Obligatoire |
|-------|------|-------------|
| `query` | `string` | oui |
| `history` | `Array<{role, content}>` | non |
| `options.attachments` | `Array<file>` | non (G32 — slots source pièce jointe) |

Appelée **en amont** de `runConversationShortCircuit()` dans `agentPipeline.js`.
`agentPipeline` passe `attachments` et propage `queryUnderstanding` vers l'orchestrateur.

### Sortie (`understandQuery`)

| Champ | Description |
|-------|-------------|
| `intentMode` | `single_intent` \| `multi_intent` |
| `workIntentCount` | Nombre d'intentions métier (hors social absorbable) |
| `primaryDomain` | Domaine dominant du premier sous-but métier |
| `domains` | Liste unique des domaines détectés |
| `intents[]` | Sous-buts qualifiés (voir schéma intent) |
| `segments[]` | Morceaux de requête après segmentation |
| `responseStrategy` | Stratégie globale (voir modes de réponse) |
| `satisfiableCount` | Sous-intentions answerable localement |
| `droppedSegmentCount` | Segments sans intention reconnue |
| `requestFrame` | Projection `analyzeRequestIntentFrame()` |
| `requestDecomposition` | Projection `decomposeRequest()` |

### Schéma intent (par segment)

```javascript
{
  domain: "math" | "training" | "webapp" | "debug" | "info_seeking" |
          "general_knowledge" | "translation" | "datetime" | "social" |
          "pedagogical" | "governance" | "document_analysis" |
          "document_synthesis" | "compare_choose",
  familyId: string,       // ex. "math_root", "product_recommendation"
  path: string,             // pipeline P2 cible
  label: string,            // libellé surface (section utilisateur)
  strategy: string,         // voir RESPONSE_STRATEGIES + guided_*
  segment: string,
  reply: string | null,     // réponse locale si disponible
  satisfiable: boolean,
  absorbable?: boolean,     // true pour social pur
  task?: {                  // G31/G32 — slots et contexte métier
    slots?: object,
    missingSlots?: string[],
    sourceType?: string,
    ...
  } | null
}
```

### Sortie plan (`buildExecutionPlan`)

| Champ | Description |
|-------|-------------|
| `steps[]` | Liste ordonnée : domain, familyId, path, strategy, label, satisfiable |
| `composite` | `true` si `workIntentCount >= 2` |
| `primaryPath` | Path du premier sous-but métier |
| `executionHint` | Hint injectable au pipeline / LLM |

---

## Les 4 temps (pipeline interne)

```
1. DÉTECTER   → workIntentCount, intentMode
2. SEGMENTER  → splitQuerySegments()
3. QUALIFIER  → detectDomainIntentInSegment() via registre
4. PLANIFIER  → buildExecutionPlan() + responseStrategy
```

### 1. Détection

- Compte les intentions **métier** (`!absorbable`).
- `multi_intent` si `workIntentCount >= 2`.
- Le social seul ne déclenche pas `multi_intent`.

### 2. Segmentation

**Connecteurs forts** (découpe systématique) :
- `et aussi`, `ainsi que`, `puis`, `ensuite`, `et puis`, `après ça`, `;`

**Connecteur faible** :
- ` et ` — seulement si **les deux** côtés ont une intention domaine reconnue (`hasRecognizedDomainIntent`).

Sinon : requête traitée comme segment unique.

### 3. Qualification

Chaque segment passe par le **registre de domaines** (`queryUnderstandingDomainRegistry.js`).
Les détecteurs appellent les guards/policies existants — pas de logique parallèle.

**Règle social absorbable** : si un segment contient à la fois un signal social (bonjour, salut…) et une intention métier, **l'intention métier prime**. Le social peut être ajouté comme intent absorbable séparé pour fusion en tête de réponse.

**Carryover v1** : contexte géométrique propagé entre segments (« son périmètre » après « aire rectangle 5×3 »).

### 4. Planification

`responseStrategy` dérivée de la couverture des sous-intentions :

| Condition | `responseStrategy` |
|-----------|-------------------|
| ≥2 work intents, tous answerable localement | `composite_deterministic` |
| ≥2 work intents, doc + datetime | `document_datetime_hybrid` |
| ≥2 work intents, couverture partielle | `partial_clarify` |
| 1 work intent | strategy du détecteur (ex. `deterministic`, `guided_synthesis`, `guided_recommendation`, `full_pipeline`) |
| Social seul | `deterministic` |
| Aucun work intent reconnu | `full_pipeline` |

---

## Les 3 modes de réponse (comportement attendu)

### Mode A — Composite immédiat

**Déclencheur** : `responseStrategy === composite_deterministic` et `resolveQueryCompositeShortCircuit()` retourne une réply.

**Path** :
- `math_composite_deterministic` — tous les domaines = math
- `query_composite_deterministic` — mix multi-domaine

**Surface** : réponse **sectionnée** (`**Label :** contenu`), une section par sous-but.

**Exemple canonique** :
```
Requête : « racine carrée d'un nombre et aussi liste des nombres premiers »
→ math_composite_deterministic
→ 2 sections : Racine carrée + Nombres premiers
```

### Mode B — Séquencé / hybride

**Déclencheur** : `multi_intent` mais pas toutes les parties answerable localement.

**Comportement** :
- `executionPlan` visible en télémétrie (`pipelineTelemetryCtx`)
- Log console : `[PIPELINE] query_understanding multi_intent domains=… strategy=…`
- Parties answerable servies si possible
- Parties non answerable **nommées** dans le plan (domain + strategy), jamais invisibilisées
- Routage du segment dominant ou pipeline complet pour le reste

**Exemple cible** :
```
Requête : « calcule 15% de 200 et mon nginx renvoie 502 »
→ domains: [math, debug]
→ strategy: partial_clarify
→ math : deterministic | debug : full_pipeline
```

### Mode C — Clarification ciblée

**Déclencheur** : sous-intention reconnue mais arguments critiques manquants.

**Comportement** :
- Clarification **sur la partie non résolue**, pas de blocage global
- `query_composite_answerable` prime sur les checks mono-intent (ex. math_root isolé)
- Interdit : « précise ton objectif » générique quand le composite est partiellement answerable

---

## Priorités P2 (ordre de routage)

Dans `intentShortCircuit.js`, **après** culture générale :

```
0. resolveQueryCompositeShortCircuit()  ← G29 prime
1. math_simple → math_root → math_geometry → math_explain → math_percent
2. … (couloirs existants)
```

**Clarification** (`clarificationDecisionPolicy.js`) :
- `isQueryCompositeSatisfiable()` **avant** `isMathRootSatisfiable()` et familles math isolées.

**Fallbacks** (`genericGreetingGuards.js`, `agentPipeline.js`) :
- `resolveQueryCompositeShortCircuit()` avant les bypass math mono-intent.

---

## Interdits structurants

| Interdit | Mécanisme |
|----------|-----------|
| Drop silencieux d'une 2ᵉ intention | `droppedSegmentCount` + message plan / réponse composite |
| Social qui parasite le métier | work > absorbable dans `detectDomainIntentInSegment()` |
| Premier pattern fort gagné | composite short-circuit avant couloirs mono-intent |
| Clarification générique sur composite answerable | `query_composite_answerable` |
| Pattern comme seule primitive | registre domaines + `understandQuery()` amont |

---

## Domaines v1 (registre)

| Domaine | familyId typique | strategy typique |
|---------|------------------|------------------|
| `math` | `math_root`, `math_geometry`, … | `deterministic` |
| `training` | `technical_learning_path` | `deterministic` ou `llm_explain` |
| `webapp` | `web_project_scoping` | `deterministic` ou `partial_clarify` |
| `debug` | `debug_diagnostic` | `full_pipeline` |
| `info_seeking` | `information_seeking` | `web_lookup` |
| `general_knowledge` | `general_knowledge` | `llm_explain` |
| `translation` | `translation_request` | `full_pipeline` |
| `datetime` | `datetime_deterministic` | `deterministic` |
| `social` | `social_deterministic` | `deterministic` (absorbable) |
| `governance` | `governance_explain` | `deterministic` |
| `document_analysis` | `document_analysis` | `document_pipeline` |
| `document_synthesis` | `document_synthesis` | `partial_clarify` \| `deterministic` \| `guided_synthesis` |
| `compare_choose` | `product_recommendation` | `partial_clarify` \| `guided_recommendation` |

---

## Playbook « intent family instrumentée » (G31 / G32)

Pattern de référence pour les domaines métier à coût d'échec élevé :

```
1. DÉTECTEUR registre G29  → domain + familyId + path
2. SLOTS requis            → partial_clarify si incomplet
3. STRATÉGIE explicite     → guided_* si slots remplis
4. CONTRAT orchestrateur   → GUIDED_* dans intentContractRegistry
5. VALIDATOR post-compose  → filtrage dérive (récence / groundedness)
6. TÉLÉMÉTRIE             → required_slots, missing_slots, triplet stratégie
```

| Famille | Critère de vérité | Contrat | Validator |
|---------|-------------------|---------|-----------|
| **G31** `compare_choose` | récence produit, budget | `GUIDED_PRODUCT_RECOMMENDATION` | `productRecoValidator` |
| **G32** `document_synthesis` | fidélité à la source | `GUIDED_DOCUMENT_SYNTHESIS` | `documentSynthesisValidator` |

---

## G29.1 — governance_explain (extension)

**Module** : `governanceExplainPolicy.js`

**Cas** : segments « En une phrase G29… », continuation doctrine, lots Gxx.

**Comportement** :
- `refineSegmentsForGovernance()` — découpe inline math + doctrine
- `unqualifiedSegmentCount` — segments sans intention métier reconnue (remplace comptage trompeur)
- Composite math + governance via `query_composite_deterministic`

**Test canonique** : requête périmètre rectangle + explication G29 en une phrase.

### G29.2 — document + datetime hybrid

**Module** : `documentAnalysisCompositePolicy.js`

| Cas | Attendu |
|-----|---------|
| `2 choses à faire : 1 - analyse fichier 2 - date/heure` | `document_datetime_hybrid` |
| Segmentation numérotée | 2 segments distincts |
| Date+heure dans un segment | pas de coupe faible sur ` et ` |
| Réponse | analyse document + sections **Date** / **Heure** déterministes |

**Path** : `document_datetime_hybrid` (append datetime après pipeline DOCUMENT)

### G30.1 — document_synthesis

**Module** : `documentSynthesisCompositePolicy.js`

| Cas | Attendu |
|-----|---------|
| `Résume ce texte sur…` | `document_synthesis`, `partial_clarify` si source absente |
| Variantes L2 (résume / synthétise / idées principales) | même famille |
| `résumé + date du jour` | `document_datetime_hybrid` |
| Shell sans source | `document_synthesis_clarify` |

### G37 — cultural_content_summary (sous-ensemble `summary/known_entity`)

**Module** : `culturalContentSummaryPolicy.js`

| Cas | Attendu |
|-----|---------|
| `résume le film Interstellar` (sans PJ) | `cultural_content_summary`, SIMPLE_FAST, pas `document_synthesis_clarify` |
| Passage collé + shell résumé | **pas** G37 — reste `document_synthesis` (G30) |
| Gate clarification | `cultural_content_summary_g37` → `CAN_ANSWER_NOW` |

**Tests** : `cultural-content-summary-routing.test.js` (7/7)

### G38 — Summary Contract Router (spec figée)

**Spec complète** : [summary-contract-g38-spec.md](./summary-contract-g38-spec.md)

> G38 unifie la famille `summary/*` sous un contrat JSON unique. G37 devient un **détecteur spécialisé** appelé par le router — pas un îlot parallèle.

#### Contrat `SummaryContract` (interface inter-plans)

```json
{
  "family": "summary",
  "intent": "summary/known_entity",
  "contract": "DIRECT_SUMMARY",
  "entity": { "kind": "film", "label": "Interstellar", "confidence": 0.92 },
  "source": {
    "type": "knowledge_base",
    "required": false,
    "provided": false,
    "missing_reason": null
  },
  "constraints": {
    "fidelity": "factual_overview",
    "max_sentences": 5,
    "spoiler_level": "low",
    "copyright_tier": "cultural_work_public_knowledge"
  },
  "resolution": {
    "strategy": "smart_default_known_entity",
    "reason": "extractable_subject, no document anchor, no attachment"
  },
  "routing": {
    "plan": "B",
    "pipelinePath": "cultural_content_summary",
    "mode": "SIMPLE_FAST",
    "forbidDocumentRequest": true,
    "forbidWebSearch": true
  },
  "clarification": { "needed": false }
}
```

#### Intents `summary/*`

| Intent | Contract | Source | Demande texte ? |
|--------|----------|--------|-----------------|
| `summary/known_entity` | `DIRECT_SUMMARY` | savoir global | **Interdit** (INV-1) |
| `summary/user_provided_text` | `TEXT_SUMMARY` | collé / PJ | Router si absent |
| `summary/web_page` | `WEB_SUMMARY` | URL + fetch | Router si URL absente |
| `summary/excerpt_or_chapter` | `TEXT_SUMMARY` | passage / chapitre | Router si chapitre sans source |
| `summary/ambiguous` | `CLARIFY_SUMMARY_KIND` | indéterminée | Clarification ciblée |

#### Invariants G38

| ID | Règle |
|----|-------|
| INV-1 | `summary/known_entity` ⇒ `forbidDocumentRequest=true` — aucun agent aval ne surcharge |
| INV-2 | Demande de texte = router (Plan A), jamais agent généraliste |
| INV-3 | `WEB_SUMMARY` ≠ `TEXT_SUMMARY` (fidélité et télémétrie distinctes) |
| INV-4 | Source explicite classée **avant** known_entity |
| INV-5 | Smart default = `resolution.strategy: smart_default_known_entity` (policy déclarée) |

#### UX produit

**Smart par défaut**, sûr seulement sur ambiguïté bloquante (« résume ce livre » sans titre, « ce passage » sans contenu).

#### Implémentation

1. Tests table-driven 30 cas (`summary-contract-g38-routing.test.js`) — **53/53**
2. `summaryContractRouter.js` — **livré**
3. `clarificationDecisionPolicy` branchée sur contrat — **livré**
4. `pipelineTelemetryCtx.summaryContract` + `recordSummaryContractTelemetry` — **livré**
5. `intentShortCircuit` contract-driven (`summaryContractShortCircuit.js`) — **livré**
6. Prompts distincts WEB_SUMMARY vs TEXT_SUMMARY — **livré** (G38.1)

---

## Extension — ajouter un détecteur (checklist)

Nouvelle famille (ex. G24 fractions) :

1. Créer / étendre la policy métier (`mathFractionPolicy.js`)
2. Ajouter `detectXDomainIntent(segment)` dans `queryUnderstandingDomainRegistry.js`
3. Enregistrer dans `SEGMENT_DETECTORS` avec `priority` cohérent
4. Retourner `{ domain, familyId, path, label, strategy, reply, satisfiable }`
5. Tests : segment isolé + composite multi-segment si pertinent
6. **Ne pas** modifier l'ordre P2 global ni `understandQuery()` — le registre suffit

---

## Cas de test canoniques

| ID | Requête (résumé) | Attendu |
|----|------------------|---------|
| G29-C1 | racine carrée + nombres premiers | `multi_intent`, `math_composite_deterministic`, 2 sections |
| G29-C2 | aire 5×3 + son périmètre | composite math, carryover géométrique |
| G29-C3 | racine carrée seule | `single_intent`, `math_root_deterministic` (inchangé) |
| G29-C4 | bonjour + racine carrée | métier prime sur social |
| G29-C5 | multi-intent non full deterministic | plan visible, `partial_clarify`, pas de drop |
| G31-C1 | smartphone sans slots | `compare_choose`, `partial_clarify`, gate `compare_choose_missing_slots` |
| G31-C2 | smartphone budget + usage | `guided_recommendation`, contrat `GUIDED_PRODUCT_RECOMMENDATION` |
| G32-C1 | résume document joint (PJ) | `guided_synthesis`, contrat `GUIDED_DOCUMENT_SYNTHESIS` |
| G32-C2 | résume ce texte (sans source) | `partial_clarify`, gate `document_synthesis_missing_source` |

**Tests automatisés** :
- `server/tests/conversation-query-understanding.test.js` — noyau G29
- `server/tests/math-composite-query-policy.test.js` — G28
- `server/tests/short-circuit-priority-matrix.test.js` — priorités P2
- `server/tests/document-datetime-composite-policy.test.js` — G29.2
- `server/tests/document-synthesis-g30-policy.test.js` — G30.1
- `server/tests/query-understanding-g30-coverage.test.js` — matrice G30 (16 verts + 4 skip)
- `server/tests/compare-choose-g31-policy.test.js` — G31.1/2
- `server/tests/guided-product-recommendation-g31-policy.test.js` — G31.3/4
- `server/tests/guided-document-synthesis-g32-policy.test.js` — G32

**Lancer la batterie G30–G32** :

```bash
cd server && node --test \
  tests/query-understanding-g30-coverage.test.js \
  tests/compare-choose-g31-policy.test.js \
  tests/guided-product-recommendation-g31-policy.test.js \
  tests/guided-document-synthesis-g32-policy.test.js
```

**G30** : voir [query-understanding-g30-coverage-spec.md](./query-understanding-g30-coverage-spec.md)

### G31.1 — compare_choose / product_recommendation

**Module** : `compareChooseCompositePolicy.js`

| Cas | Attendu |
|-----|---------|
| `je veux acheter un smartphone, que me conseilles-tu` | `compare_choose`, `partial_clarify` (budget + usage) |
| Budget + usage renseignés | `guided_recommendation` |
| Patterns indicatifs | `conseilles-tu`, `me conseilles`, `tu recommandes`, `meilleur smartphone` |

**Observabilité** : `strategy_declared` / `strategy_effective` / `strategy_override_reason`

### G31.2 — slots + gate clarification

**Modules** : `compareChooseCompositePolicy.js`, `clarificationDecisionPolicy.js`

| Slot | Obligatoire (produit) |
|------|----------------------|
| `budget` | oui |
| `usage` | oui |

| Gate | Raison |
|------|--------|
| Slots manquants | `compare_choose_missing_slots` → `NEEDS_CLARIFICATION` |
| Slots remplis | `compare_choose_answerable` → orchestrateur |

**Interdit** : bypass `clarify_then_build` / `DIRECT_EXPLANATION` sur reco produit sans slots.

### G31.3 — guided_recommendation (contrat + limites web)

**Module** : `guidedProductRecommendationPolicy.js`

| Cas | Attendu |
|-----|---------|
| Slots budget + usage remplis | `GUIDED_PRODUCT_RECOMMENDATION` forcé |
| Web search | max **3 sources**, timeout **8s** |
| Télémétrie | `required_slots`, `missing_slots`, `policy_match_reason`, `domain_confidence` |

**Contrat** : `intentContractRegistry.js` — priority 715, `isGuidedProductRecommendationRequest`

### G31.4 — productRecoValidator (post-search)

**Module** : `productRecoValidator.js`

| Cas | Attendu |
|-----|---------|
| Sources obsolètes (iPhone 15, S23…) | filtrées avant injection |
| Budget ≤700 + flagship hors budget | source écartée |
| Réponse finale avec modèle obsolète | sanitization + note récence |
| Audit | `product_reco_validation` dans packet / `pipelineTelemetryCtx.productRecoValidation` |

### G32.1 — document_synthesis slots

**Module** : `documentSynthesisCompositePolicy.js`

| Cas | Attendu |
|-----|---------|
| `Résume ce texte` (sans source) | `partial_clarify`, `missing_slots: [source]` |
| Passage collé / pièce jointe | `guided_synthesis` |
| Slots | `source`, `length` (court/moyen), `focus` optionnel |

### G32.2 — guided_synthesis + gate

| Cas | Attendu |
|-----|---------|
| Source absente | `document_synthesis_missing_source` → `NEEDS_CLARIFICATION` |
| Stratégie | triplet `strategy_declared` / `effective` / `override` |

### G32.3 — GUIDED_DOCUMENT_SYNTHESIS (contrat)

**Module** : `guidedDocumentSynthesisPolicy.js`

| Cas | Attendu |
|-----|---------|
| Slots remplis | contrat `GUIDED_DOCUMENT_SYNTHESIS` forcé |
| Web search | **désactivé** (`skipWebSearch: true`) |
| Exécution | température 0.2, tokens max selon `length` |

### G32.4 — documentSynthesisValidator (post-compose)

**Module** : `documentSynthesisValidator.js`

| Cas | Attendu |
|-----|---------|
| Résumé générique sans ancrage | `generic_synthesis_template` |
| Tokens source absents de la réponse | `insufficient_source_anchoring` |
| Télémétrie | `pipelineTelemetryCtx.documentSynthesisValidation` + `groundedness` |

---

## Télémétrie / observabilité

| Signal | Où |
|--------|-----|
| `[PIPELINE] query_understanding multi_intent…` | Console `agentPipeline.js` |
| `pipelineTelemetryCtx.queryUnderstanding` | Télémétrie tour (`required_slots`, `missing_slots`, `policy_match_reason`) |
| `pipelineTelemetryCtx.intentContractId` | Contrat forcé (ex. `GUIDED_PRODUCT_RECOMMENDATION`) |
| `pipelineTelemetryCtx.productRecoValidation` | Issues post-compose G31.4 |
| `pipelineTelemetryCtx.documentSynthesisValidation` | Groundedness post-compose G32.4 |
| `pipelineTelemetryCtx.executionPlan` | Télémétrie tour |
| `pipelineTelemetryCtx.strategyExecution` | Triplet `strategy_declared` / `effective` / `override_reason` |
| `[PIPELINE] strategy declared=… effective=… override=…` | Console `agentPipeline.js` |
| `packet.meta.product_reco_slots` | Slots G31 vers orchestrateur |
| `packet.meta.document_synthesis_slots` | Slots G32 vers orchestrateur |

---

## Règles d'échec

| Situation | Comportement attendu |
|-----------|---------------------|
| Segment non reconnu | `droppedSegmentCount++`, mention explicite dans plan ou réponse |
| Intent reconnu, pas answerable | Nommer la sous-demande + strategy (`full_pipeline`, etc.) |
| Composite partiellement answerable | Servir les parties possibles, clarifier le reste **ciblé** |
| Aucun intent métier | Fallback `full_pipeline` / couloirs existants, pas de faux composite |
| Régression mono-intent | Les requêtes single-intent ne doivent **pas** changer de path |
| Reco produit sans slots | Pas de `DIRECT_EXPLANATION` ni web search non borné (G31) |
| Synthèse sans source | Pas de résumé halluciné — clarify ou validator (G32) |
| `résume` + `document joint` | `document_synthesis` prime sur `document_analysis` (G32) |
| `résume Interstellar` (sans PJ) | G37 / G38 `known_entity` — **jamais** demande de document (INV-1) |
| `résume ce passage` sans texte | G38 router demande source — pas COMPOSER |

---

## Backlog (juin 2026)

| Ticket | Périmètre | Statut |
|--------|-----------|--------|
| G30.2 | Dissertation / rédaction longue | gap |
| G30.3 | Scoping agent IA mobile | gap |
| G30.5 | Composite dissertation + translation | gap |
| G30.6 | Composite webapp + explain | gap |
| G33 | Dissertation guidée (extension G32 + slots pédagogiques) | planifié |
| **G38** | Summary Contract Router — contrat `summary/*`, router unifié | **spec figée** |

---

## Journal de session (juin 2026)

| Lot | Livrable |
|-----|----------|
| G29.2 | `document_datetime_hybrid` — analyse fichier + datetime |
| G30 | Matrice couverture `queryUnderstandingCoverageMatrix.js` |
| G30.1 | Domaine `document_synthesis` dans registre G29 |
| G31.1–2 | `compare_choose` + slots budget/usage + gate + triplet stratégie |
| G31.3–4 | Contrat `GUIDED_PRODUCT_RECOMMENDATION` + validator post-search/reply |
| G32.1–4 | Contrat `GUIDED_DOCUMENT_SYNTHESIS` + validator groundedness + routing synthèse/analyse |
| G37 | `cultural_content_summary` — résumé œuvre culturelle sans PJ |
| G38 | Spec `SummaryContract` — router `summary/*` (implémentation planifiée) |

---

## Résumé en une phrase

Nexxus traite une requête multi-actions comme un **plan d'exécution gouverné** : lire tout, qualifier chaque morceau, choisir la stratégie par morceau, restituer en sections ou nommer explicitement ce qui manque — sans jamais agir comme si une seule sous-intention méritait d'exister.
