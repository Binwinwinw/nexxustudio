# Architecture Rules

## Règle Mnémotechnique

- `agent.js` = conversation légère
- `knowledge/` = vérité métier
- `constitution` = règle globale

## Objectif

Cette règle évite de mélanger :

- les micro-réponses sociales locales
- les vérités produit du Studio
- les règles globales de comportement

Le système doit rester maintenable, auditable et gouverné par des sources explicites.

## 1. `agent.js`

`agent.js` ne doit contenir que :

- salutations courtes
- remerciements
- clôtures simples
- micro-réponses sociales sans portée produit
- petite relance polie ou taquine à faible risque

`agent.js` ne doit pas contenir :

- la description du Studio
- la description de la Forge
- les capacités produit de l'assistant
- l'explication du fonctionnement interne de Nexxus
- les limites produit
- les rôles, équipes ou organisations

## 2. `knowledge/`

`knowledge/` contient les assertions métier gouvernées, versionnées et routables.

On y place :

- identité produit de Nexxus
- rôle de l'assistant
- capacités du Studio
- fonctionnement de la Forge
- fonctionnement documenté de Nexxus
- limites et périmètre
- définitions des phases et des livrables

Chaque vérité métier doit idéalement avoir :

- un document cible
- une entrée `manifest`
- un `owner`
- un `lastReviewedAt`
- un `mode`
- un `fallbackPolicy`

## 3. Constitution

La constitution regroupe les règles transversales :

- ne pas inventer
- ne pas se présenter comme humain
- ne pas extrapoler hors des sources gouvernées
- respecter la hiérarchie des sources
- préférer dire qu'une information n'est pas définie actuellement
- respecter la langue, le style et la posture du Studio

Si une règle doit s'appliquer à toutes les réponses, elle doit vivre dans la constitution et non dans `agent.js` ou dans un document métier isolé.

## Test Mental

Si la réponse décrit le système, elle relève de `knowledge/`.

Si la réponse impose un comportement transversal, elle relève de la constitution.

Si la réponse est une micro-interaction locale sans portée produit, elle peut rester dans `agent.js`.

## Règle de Fallback

Si un topic gouverné est détecté mais qu'aucune source fiable n'est disponible :

- ne pas basculer vers une génération libre
- répondre explicitement que l'information n'est pas définie actuellement

## Checklist de Migration

Pour retirer une vérité de `agent.js`, vérifier :

1. La vérité a-t-elle été migrée dans `knowledge/` ?
2. Une entrée `manifest` existe-t-elle ?
3. Le `mode` est-il validé (`direct_answer` ou `grounded_generation`) ?
4. La source a-t-elle une preuve d'autorité (`owner`, `lastReviewedAt`) ?
5. Une régression a-t-elle été ajoutée ?
6. La branche hardcodée a-t-elle été supprimée ?

## État Actuel

Ce qui a vocation à rester dans `agent.js` :

- `salut`
- `bonjour`
- `coucou`
- `ça va`
- réponses sociales courtes apparentées
- message social taquin de faible risque

Ce qui ne doit plus être ajouté dans `agent.js` :

- identité produit
- fonctionnalités de l'assistant
- fonctionnement de la Forge
- fonctionnement de Nexxus
- périmètre du Studio

## 4. `policies/` — découpage par domaine (audit global racine clôturé)

Objectif : réduire le bruit d’un dossier plat (~140 fichiers) sans big bang.

### 4.1 État (2026-08-01)

| Phase | Statut | Contenu |
|-------|--------|---------|
| **1 — Move-only** | **Terminée** | Implémentations sous `policies/<domaine>/` ; wrappers `@deprecated` à la racine tant qu’il reste des appelants. |
| **2 — Migration imports** | **En cours** | Pointer les consommateurs vers le barrel domaine ou le fichier cible ; supprimer le wrapper racine quand plus aucun appelant. Un domaine = un commit atomique. |
| **B — Routage déterministe** | **Hors périmètre move** | Rouges d’ordre de short-circuits / contrats ; ne bloquent pas la clôture structurelle de la phase 2. |

**Imports pilotes déjà migrés :** `agentPipeline.js`, `intentShortCircuit.js`, `systemPromptBuilder.js`, `socialPrompt.js`.

### 4.2 Règles

- **Move-only** d’abord : pas de renommage de symboles exportés dans la première passe.
- **Wrappers** à l’ancien chemin (`policies/fooPolicy.js` → `export * from "./domain/fooPolicy.js"`) jusqu’à migration des imports.
- **Barrel par domaine** (`policies/math/index.js`, `policies/connectors/index.js`, etc.) pour les nouveaux imports — pas d’usage omniprésent d’un `policies/index.js` global.
- Les barrels sont des **façades de domaine** destinées à réduire le bruit local et à faciliter la migration ; ils ne constituent **pas** un point d’entrée universel pour tout `policies/`. Préférer `./policies/<domaine>/<fichier>.js` quand un seul module suffit.
- **Phase 2 :** un lot logique = un domaine = un commit (`refactor(agent/policies): phase 2 migrate <domaine> imports`). Ne pas mélanger deux domaines dans le même commit. Figer (commit) avant d’élargir.
- **Phase 2 fusion** de modules seulement si >80 % des PR touchent le lot entier (co-évolution).

### 4.3 Phase 2 — lots déjà migrés (wrappers racine retirés)

`math`, `connectors`, `epistemic`, `execution`, `guards`, `core`, `orchestration`, `analysis`, `familiarity`, `workload`, `attachment`, `summary`, `document`, `guided`, `posture`, `prompt`, `delivery`, `pedagogical`, `code`, `meta`, `qualification` (`ec963a7`), `social` (`105af74`).

### 4.4 Phase 2 — reste à faire (~40 wrappers racine)

Ordre recommandé : **web → conversation → intent → routing** (routing en dernier : plus d’appelants, hub de dépendances).

| Domaine | Wrappers restants (approx.) | Notes |
|---------|----------------------------:|-------|
| `web` | 8 | **Prochain lot.** |
| `conversation` | 10 | Après web. |
| `intent` | 7 | Après conversation. |
| `routing` | 15 | **Dernier** — beaucoup d’imports croisés. |

Pour chaque lot : migrer les imports → supprimer les wrappers racine du domaine → tests ciblés du domaine → commit atomique. Les rouges chantier B déjà connus ne doivent pas bloquer le commit move-only.

### 4.5 Domaines validés (carte)

| Dossier | Contenu |
|---------|---------|
| `policies/analysis/` | `existingSourceAnalysis`, `repoAnalysis` |
| `policies/attachment/` | `attachmentTask`, `attachmentInterpretation` |
| `policies/code/` | `code*Policy`, `code*Contract`, `code*Sentinels`, `codeProjectLight*`, `frontendPresentationQualityContract` |
| `policies/connectors/` | `connectorRegistry`, `connectorPhaseC`, `connectorPlanTelemetry` |
| `policies/conversation/` | `conversationQueryUnderstanding`, `conversationMove*`, `conversationTurnRouting`, `conversationSubjectExtraction`, `exploratoryConversation`, `openExplorationFrame`, `queryUnderstandingDomainRegistry`, `queryUnderstandingCoverageMatrix` |
| `policies/core/` | `agentRole` |
| `policies/delivery/` | `deliverableContract`, `deliverablePromiseGuard`, `deliveryContract`, `constructiveDelivery`, `formalLetterTemplate`, `htmlProjectDelivery`, `htmlWorkshopDeliveryContract`, `htmlProjectDeliveryThresholds`, `promptForArtifact`, `pythonDelivery` |
| `policies/document/` | `documentSynthesis*`, `documentAnalysisComposite`, `documentWebCompare`, `documentCapabilityContract` |
| `policies/epistemic/` | `epistemicUncertaintyResolution`, `uncertainty`, `aiVerification` |
| `policies/execution/` | `executionBrief` |
| `policies/familiarity/` | `familiarityDomainOverview`, `subjectReferenceResume` |
| `policies/guards/` | `fileContextGuard` |
| `policies/guided/` | `guidedProductRecommendation`, `guidedDocumentSynthesis`, `guidedCreationScoping`, `guidedChoice`, `productRecoValidator` |
| `policies/intent/` | `justIntent*`, `intentComposition*`, `intentCompatibilityMatrix`, `intentFamilyRegistry`, `requestIntentFrame`, `conversationIntentFrame` |
| `policies/math/` | `math*Policy`, `mathCompositeQueryPolicy` |
| `policies/meta/` | `metaAssistantBehavior`, `metaCapabilities`, `comprehensionGrounding`, `openPromptContinuity`, `governanceExplain` |
| `policies/orchestration/` | `chatAgentProfile` |
| `policies/pedagogical/` | `pedagogySoftOverview`, `pedagogySoftOverviewKnowledge`, `pedagogicalCoverage`, `pedagogicalCoverageRegistry`, `pedagogicalTableScheduler`, `lexiconExplainLight` |
| `policies/posture/` | `addressing`, `voiceContinuity`, `posture`, `sessionModeState`, `responseStyle`, `responseManner`, `style`, `structuredGenerativeTemplate` |
| `policies/prompt/` | `context`, `error`, `outputContract`, `coreIdentity`, `tool` |
| `policies/qualification/` | `howToQualification`, `subjectTyping`, `assistantUtteranceClarify`, `pendingClarificationResume`, `adminProcedureCoverage` |
| `policies/routing/` | `practicalAdviceRoutingGuard`, `reactAuditContractRouter`, `reactAuditShortCircuit`, `explicitWebSearchRequest`, `informationSeekingOrchestration`, `informationSeekingLight`, `informationSeekingQualification`, `clarificationDecision`, `requestDecomposition`, `shortCircuitCognitiveCycle`, `researchThenSummarize`, `knowledgeEnrichment`, `generalKnowledgeEnrichment`, `compareChooseComposite`, `multiSegmentQualification` |
| `policies/social/` | `socialPattern`, `socialChatContinuity`, `socialAcceptanceOfOffer`, `socialCompositeReply`, `casualExplanationLight` |
| `policies/summary/` | `summaryContract*`, `culturalContentSummary*`, `knownEntitySummary*` |
| `policies/web/` | `webSource`, `webSearchThreadContinuity`, `currentWebFact`, `knowledgeFreshness`, `externalCalendarLookup`, `trafficCurrentRequest`, `weatherCurrentRequest`, `webEvidenceFidelity` |
| `policies/workload/` | `requestWorkloadSignal`, `workUnitCountAndPlan` |

### 4.6 Chantier B — hors périmètre move-only

Routage connu (ordre des short-circuits, même famille causale) — **ne bloque pas** la phase 2 :

- `social-composite-g41-1` — G41.1-T03 : `meta_conversation_deterministic` gagne avant `social_composite_deterministic`.
- G44 / G45 — `exploratory_conversation_light` peut gagner avant `assistant_utterance_clarify_deterministic` / `assistant_repair_deterministic`.
- G11 web_project_scoping — `ideation_deterministic` peut gagner avant `web_project_scoping_direct` (type de site explicite).
- `connector-registry` / `connector-phase-c` — fiches JSX / `technical_learning_path` : `local_deterministic` (ideation ou reply prête) avant `local_generative`.
- `clarification-decision-policy` — corpus `encyclopedic_familiarity` / `explanatory_general_knowledge`.
- `traffic-current-request-policy` — Paris + en ce moment → web prioritaire.
- `external-calendar-lookup-routing` — pleine lune → web prioritaire.
- `file-context-guard` — TDZ `WORK_CULTURAL_MARKER_RE` dans `codeConceptExplainPolicy.js`.
- `familiarity-domain-overview` — `lexicon_explain_light` vs `familiarity_domain_overview`.
- `repo-analysis-v1` — GitHub → mauvais contrat LLM.

Les traiter dans une passe dédiée routage déterministe vs génératif (chantier B), pas dans les commits phase 2.
