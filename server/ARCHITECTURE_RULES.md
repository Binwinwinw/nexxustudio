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

## 4. `policies/` — découpage par domaine (pilote en cours)

Objectif : réduire le bruit d’un dossier plat (~140 fichiers) sans big bang.

**Règles :**

- **Move-only** d’abord : pas de renommage de symboles exportés dans la première passe.
- **Wrappers** à l’ancien chemin (`policies/fooPolicy.js` → `export * from "./domain/fooPolicy.js"`) jusqu’à migration des imports.
- **Barrel par domaine** (`policies/math/index.js`, `policies/connectors/index.js`, etc.) pour les nouveaux imports — pas d’usage omniprésent d’un `policies/index.js` global.
- Les barrels sont des **façades de domaine** destinées à réduire le bruit local et à faciliter la migration ; ils ne constituent **pas** un point d’entrée universel pour tout `policies/`. Préférer `./policies/<domaine>/<fichier>.js` quand un seul module suffit.
- **Phase 2 fusion** seulement si >80 % des PR touchent le lot entier (co-évolution).

**Pilote validé :**

| Dossier | Contenu |
|---------|---------|
| `policies/connectors/` | `connectorRegistry`, `connectorPhaseC`, `connectorPlanTelemetry` |
| `policies/math/` | `math*Policy`, `mathCompositeQueryPolicy` |
| `policies/summary/` | `summaryContract*`, `culturalContentSummary*`, `knownEntitySummary*` |
| `policies/social/` | `socialPattern`, `socialChatContinuity`, `socialAcceptanceOfOffer`, `socialCompositeReply` |
| `policies/code/` | `code*Policy`, `code*Contract`, `code*Sentinels`, `codeProjectLight*` |
| `policies/intent/` | `justIntent*`, `intentComposition*`, `intentCompatibilityMatrix`, `intentFamilyRegistry`, `requestIntentFrame`, `conversationIntentFrame` |
| `policies/conversation/` | `conversationQueryUnderstanding`, `conversationMove*`, `conversationTurnRouting`, `conversationSubjectExtraction`, `exploratoryConversation`, `queryUnderstandingDomainRegistry`, `queryUnderstandingCoverageMatrix` |
| `policies/meta/` | `metaAssistantBehavior`, `metaCapabilities`, `comprehensionGrounding`, `openPromptContinuity` |
| `policies/guided/` | `guidedProductRecommendation`, `guidedDocumentSynthesis`, `guidedCreationScoping`, `guidedChoice` |
| `policies/document/` | `documentSynthesis*`, `documentAnalysisComposite`, `documentWebCompare`, `documentCapabilityContract` |
| `policies/attachment/` | `attachmentTask`, `attachmentInterpretation` |
| `policies/delivery/` | `deliverableContract`, `deliverablePromiseGuard`, `deliveryContract`, `constructiveDelivery`, `htmlProjectDelivery`, `htmlWorkshopDeliveryContract`, `htmlProjectDeliveryThresholds`, `pythonDelivery` |
| `policies/routing/` | `practicalAdviceRoutingGuard`, `reactAuditContractRouter`, `reactAuditShortCircuit`, `explicitWebSearchRequest`, `informationSeekingOrchestration`, `informationSeekingLight`, `informationSeekingQualification`, `clarificationDecision`, `requestDecomposition`, `shortCircuitCognitiveCycle`, `researchThenSummarize`, `knowledgeEnrichment`, `compareChooseComposite`, `multiSegmentQualification` |
| `policies/web/` | `webSource`, `webSearchThreadContinuity`, `currentWebFact`, `knowledgeFreshness`, `externalCalendarLookup`, `trafficCurrentRequest`, `weatherCurrentRequest`, `webEvidenceFidelity` |
| `policies/qualification/` | `howToQualification`, `subjectTyping`, `assistantUtteranceClarify`, `pendingClarificationResume` |
| `policies/posture/` | `addressing`, `voiceContinuity`, `posture`, `sessionModeState`, `responseStyle`, `responseManner`, `style` |
| `policies/epistemic/` | `epistemicUncertaintyResolution`, `uncertainty`, `aiVerification` |
| `policies/pedagogical/` | `pedagogySoftOverview`, `pedagogySoftOverviewKnowledge`, `pedagogicalCoverage`, `pedagogicalCoverageRegistry`, `pedagogicalTableScheduler`, `lexiconExplainLight` |

**Ordre de migration suivant :** lots restants au fil des PR — pas de big bang.

**Pilote domaine `meta/` clôturé** avec les slices connectors → meta ci-dessus.

**Routage connu hors périmètre move-only** (chantier B — ordre des short-circuits, même famille causale) :

- `social-composite-g41-1` — G41.1-T03 : `meta_conversation_deterministic` gagne avant `social_composite_deterministic`.
- `connector-registry` / `connector-phase-c` — fiches JSX / `technical_learning_path` : `local_deterministic` (ideation ou reply prête) avant `local_generative`.

Ne pas bloquer la validation structurelle sur ces rouges ; les traiter dans une passe dédiée routage déterministe vs génératif.
