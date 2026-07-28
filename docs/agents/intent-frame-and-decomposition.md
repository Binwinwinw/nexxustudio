# IntentFrame et décomposition — La Citadelle

Mécanique runtime **amont** : comment une requête est comprise avant le choix de famille.

**Voir aussi** :
- [Doctrine / charte](intent-families-doctrine.md)
- [Catalogue familles et contraintes](family-catalog-and-constraints.md)
- [Changelog lots et batteries](intent-families-changelog.md)
- [G29 Query Understanding — spec fonctionnelle](query-understanding-g29-spec.md)


## IntentFrame — contrat API interne (v1.1)

Couche amont **déterministe d'abord**, LLM en enrichisseur seulement si ambiguïté persistante (`semanticIntentResolver` en assist mode).

### Objectif

Éviter de router sur la surface (« comment » + « ? » → factuel) ou sur une étiquette unique (`general/explain`).
Produire une **représentation intermédiaire** consommée par les short-circuits, les guards et (demain) justIntent.

### Fichiers

| Fichier | Périmètre |
|---------|-----------|
| `conversationIntentFrame.js` | Axes conversationnels : social, tâche générique, composite |
| `requestIntentFrame.js` | Frame complet + axes métier + `familyHint` |

### Schéma (`analyzeRequestIntentFrame`)

```javascript
{
  version: "1.1",
  normalized: string,
  conversation: {
    social: { greeting, checkin, shortSocial, identity, asksTime, asksDate },
    task: { present, helpRequest, workRequest, actionRequest },
    socialOnly: boolean,
    composite: boolean,
    confidence: "high" | "medium" | "low"
  },
  task: {
    kind: "learn" | "explain" | "career_path" | null,  // v1.1 — autres kinds plus tard
    present: boolean
  },
  domain: {
    kind: "technical" | "career" | "social" | null,
    target: string | null   // ex. "react", "redis", "développeur web"
  },
  composite: boolean,
  familyHint: { id: string, confidence: "high"|"medium"|"low" } | null,
  needsClarification: boolean,
  clarificationReason: string | null,
  confidence: "high" | "medium" | "low"
}
```

### Définitions des axes

| Champ | Signification | Détection (v1.1) |
|-------|---------------|------------------|
| `conversation.socialOnly` | Check-in / salutation sans objet métier | Wellbeing ciblant l'assistant, sans `task.present` |
| `conversation.composite` | Social + demande dans le même message | Greeting/check-in **et** aide/explication/action |
| `task.kind: learn` | Maîtriser / parcours / fiches stack | `isTechnicalLearningPathRequest()` |
| `task.kind: explain` | Aperçu ponctuel « c'est quoi X » | `isTechnicalOverviewRequest()` |
| `task.kind: career_path` | Parcours métier / reconversion | `isCareerLearningPathRequest()` |
| `domain.kind` | Registre sémantique du job | Dérivé de `task.kind` + signaux carrière/tech |
| `domain.target` | Objet extrait (stack, techno, rôle) | Parsers existants (`parseTechnicalLearningPath`, etc.) |
| `familyHint` | Famille probable avant short-circuit final | Guards exclusifs ; confidence `high` si request, `low` si signal seul |
| `needsClarification` | Plusieurs lectures plausibles | Signaux multi-familles, composite sans `task.kind`, hint faible |

### Priorités de composition

Ordre appliqué **avant** le choix de famille :

1. **Social pur** (`socialOnly`) → `social_deterministic` — jamais `simple_factual_lookup`
2. **Composite** (social + tâche) → route **tâche** ; le social n'absorbe pas le métier
3. **Comment explicatif** (`comment fonctionne X`) → `explain`, pas social
4. **Préemption familiale** (plus spécifique gagne) :

```
debug_diagnostic → compare_choose → career_learning_path (shell principal)
  → technical_learning_path → technical_overview
```

Motivation emploi **secondaire** (« pour trouver un job ») sans shell carrière → **ne bloque pas** TLP si `isStrongTechnicalLearningShell()`.

Shell **recherche d'information** (`informationSeekingIntentGuards.js`) : « je cherche des infos sur X » → `task.present`, `task.kind=explain`, prime sur `socialOnly` même avec salutation.

Shell **demande de parcours** (`learningRequestIntentGuards.js`) : « apprentissage de X » + progression/conseil → `task.kind=learn`, prime sur `compare_choose` (« que me conseillerais-tu » seul reste arbitrage). Domaine technique → pont `technical_learning_path` ; hors tech (ex. poker) → `domain.kind=general`, famille dédiée v1.3+.

5. **justIntent** = projection du frame (`projectFrameToJustIntentHints`) — pas l'inverse

### Exemples canoniques

| Requête | `socialOnly` | `task.kind` | `familyHint.id` |
|---------|--------------|-------------|-----------------|
| `yop comment ça va là dedans ?` | true | null | null |
| `salut, tu peux m'aider sur React ?` | false | `explain` | `technical_overview` |
| `salut, plan pour apprendre React pour un job` | false | `learn` | `technical_learning_path` |
| `créer des fiches pour maîtriser React` | false | `learn` | `technical_learning_path` |
| `explique Redis` | false | `explain` | `technical_overview` |
| `comment devenir développeur web` | false | `career_path` | `career_learning_path` |
| `Comment fonctionne HTTP/2 ?` | false | `explain` | `technical_overview` |
| `comment tu vas gérer ça ?` | false | null | null |
| `pour un apprentissage du poker que me conseillerais-tu ?` | false | `learn` | null (→ orchestrateur plan ; pas `compare_choose`) |
| `je cherche des infos sur Teams 365` | false | `explain` | null |

Shell **possession d'information** (extension v1.1.2) : « quelles informations as-tu / aurais-tu du jeu X » → `information_seeking_full_pipeline` + web, pas `simple_factual_lookup`. Shadow : `[INTENT_FRAME]` en telemetry.

**Fallback web (niveau 2)** — si `simple_factual_lookup` échoue malgré tout :

```
shouldEscalateSimpleFactualToFullPipeline(query, fallbackReason, responseText)
  := (fallbackReason === "empty_short_circuit_llm" OU recovery template)
     ET isInformationSeekingWithTarget(query)
  → information_seeking_escalation + expert_web_search
```

Requête web dérivée : `buildInformationSeekingWebQuery(query)` (ex. « kingofavalon jeu stratégie overview site officiel »).

### Politique d'orchestration aval (v1.1.3)

Matrice unique `information_seeking_with_target(X)` — signaux observables, pas heuristique implicite :

| Situation | `recommended_action` | Web |
|-----------|----------------------|-----|
| Fiche locale forte (`localConfidence=high`) | `deliver_local` | non |
| Couverture partielle / confiance moyenne | `full_pipeline` | optionnel |
| Miss local, `empty_short_circuit_llm`, recovery template | `web_fallback` | oui (`buildInformationSeekingWebQuery`) |

Signaux loggés : `[INFO_SEEK_ORCH]` — `shell_recognized`, `target`, `target_type`, `local_answer_found`, `local_confidence`, `short_circuit_status`, `escalation_reason`, `web_fallback_triggered`, `web_query`.

Implémentation : `informationSeekingOrchestrationPolicy.js` + enrichissement via `knowledgeEnrichmentPolicy.js`. Requête web injectée à l'orchestrateur (`webSearchQuery`).

Formulations unifiées (v1.1.2) : « quelles informations sur X », « que sais-tu du X » (prime sur familiarity), « infos sur X » (shell court). Batterie #15–#18 (tigre, Taj Mahal, kimono).
### Décomposition gouvernée des requêtes (v1.2)

Couche amont `decomposeRequest(query, history)` — avant `justIntent` :

| `request_mode` | Cas | Exécution |
|----------------|-----|-----------|
| `single` | une demande, un cadre | routage actuel |
| `multi_target` | même `task.kind`, N cibles (ex. 4 langues) | `batch` via `translationPlan` |
| `multi_unit` | cadres hétérogènes (social + HTML + conseil + calcul) | `multi_unit` — sections agrégées |

**Unité** (`requestUnits[]`) :

```
{ id, unitType, taskKind, familyHint, payload, priority, absorbable, dependsOn }
```

| `unitType` | `task.kind` | Comportement |
|------------|-------------|--------------|
| `social_greeting` | social | `absorbable: true` — préambule, non bloquant |
| `social_checkin` | social | `absorbable: true` — « comment ça va », check-in bien-être |
| `time_request` | explain | heure locale — `datetime_deterministic` |
| `date_request` | explain | date du jour — `datetime_deterministic` |
| `how_to_request` | explain | procédure — **qualifiée** via `classifyHowToScopeAndRisk()` avant réponse |

Qualification how-to (`howToQualificationPolicy.js`) :

| `howToQualification` | Comportement |
|----------------------|--------------|
| `simple_benign_local` | satisfiable → réponse locale (smoothie, avion en papier…) |
| `ambiguous` | clarification ciblée (avion, fusée sans qualificateur) |
| `complex_but_benign` | cadrage / vue d'ensemble (vrai avion, projet lourd) |
| `sensitive_or_restricted` | politique sécurité (hors périmètre local) |

Principe #7 affiné : **satisfiable localement et qualifié bénin/simple → déterministe** ; sinon clarification ciblée ou orchestration.

Chemins : `how_to_simple_local`, `how_to_clarify`, `how_to_complex_clarify`, `multi_unit_partial_clarify` (faits servis + précision how-to).

> Batterie **#25** — voir [changelog](intent-families-changelog.md).

#### Reprise clarification en attente (v1.2.2)

`resumePendingClarification(query, history)` — **avant** `decomposeRequest` / `justIntent` :

1. Détecte une clarification active dans le dernier message assistant (`how_to_scope`)
2. Tente de remplir le slot (`paper_aircraft`, `model`, `real_aircraft`)
3. Si résolu → réponse directe (`how_to_simple_local`, `how_to_complex_clarify`) + `skipClarificationGate`

> Batterie **#26** — voir [changelog](intent-families-changelog.md).

| `unitType` | `task.kind` | Famille / couloir |
|------------|-------------|-------------------|
| `translate` | translate | `translation_request` |
| `html_transform` | build | `html_project` |
| `advice` | explain | `general_knowledge_full_pipeline` |
| `calculate` | explain | `simple_factual_lookup` |
| `information_seeking` | explain | `information_seeking_full_pipeline` |

Telemetry : `[REQUEST_DECOMP]` — `request_mode`, `unit_count`, `unit_types`, `execution_mode`, `contains_social_preamble`, `has_cross_unit_dependencies`.

Exemple hétérogène (clauses) :
```
[REQUEST_DECOMP] {"unit_count":4,"unit_types":["social_greeting","html_transform","advice","calculate"],"execution_mode":"multi_unit"}
```

#### Inventaire multi-signaux (v1.2.1)

Le découpage par clauses seul (`splitRequestClauses`) est insuffisant pour les messages oraux naturels : ponctuation lâche, coordination (« et », « de »), redondance sociale et demandes imbriquées dans une seule phrase.

`inventoryRequestUnits(query)` scanne la **requête complète** (normalisée via `normalizeForParse`) et détecte les signaux suivants en parallèle :

| Signal | `unitType` | Exemples lexicaux |
|--------|------------|-------------------|
| Salutation | `social_greeting` | salut, bonjour, hey, coucou |
| Check-in | `social_checkin` | comment ça va, tu vas bien |
| Heure | `time_request` | quelle heure, besoin de l'heure, j'ai besoin de l'heure |
| Date | `date_request` | date du jour, on est quel jour |
| How-to court | `how_to_request` | comment on fait…, sais-tu comment faire…, savoir si tu sais comment |

Fusion : si l'inventaire retourne ≥ 2 unités → priorité sur le découpage clause ; sinon, clauses multiples ou inventaire partiel.

Chaque unité porte `satisfiable: true|false` — capacité à être servie immédiatement par des handlers locaux (sans LLM de composition).

#### Hiérarchie satisfiabilité → préemption (v1.2.1)

Chaîne appliquée **avant** `multi_segment_composite` et `SIMPLE_FAST` :

```
decomposeRequest()
  → allWorkUnitsSatisfiable()     // toutes les unités métier servables localement ?
  → shouldPreemptMultiSegment()   // multi_unit + satisfiable
  → multi_unit_deterministic      // réponse sectionnée, pas de clarification
  → sinon orchestration / LLM
```

| Fonction | Rôle |
|----------|------|
| `allWorkUnitsSatisfiable()` | ≥ 2 unités métier (`!absorbable`) et chacune `satisfiable !== false` |
| `shouldPreemptMultiSegment()` | `request_mode === multi_unit` **et** satisfiable → bloque `multi_segment_composite` |
| `suppressesClarificationForDecomposedRequest()` | clarification interdite si satisfiable |
| `buildMultiUnitCompositeReply()` | agrège les unités ; choisit la surface (`natural_fusion` ou `sectioned`) |
| `resolveMultiUnitSurfaceStyle()` | ≤ 4 unités métier légères → fusion ; sinon sectionné |
| `canServeMultiUnitComposite()` | gate avant émission du short-circuit |

Chemin short-circuit : `multi_unit_deterministic` — placé **avant** `social_deterministic` et `multi_segment_composite` dans `intentShortCircuit.js`.

**Contrat de réponse** (unités satisfiables) — deux surfaces :

| Style | Quand | Forme |
|-------|-------|-------|
| `natural_fusion` | 2–4 unités courtes compatibles (heure, date, how-to) | 1–2 phrases fluides, sans labels `**Heure :**` |
| `sectioned` | plus d'unités ou contenu plus lourd | lignes/sections distinctes |

Exemple fusion (changelog #24) :

```
Salut ! Ça va bien de mon côté. Nous sommes {date fr-FR} et il est {heure fr-FR}. Pour faire un smoothie, choisis un fruit…
```

Pas de clôture générique (« n'hésite pas… », « j'ai répondu à toutes tes demandes »).

Mode : `INSTANT` avec `enforce.sectionedComposite: true` — pas de troncature 6 lignes.

> Batterie **#24** — voir [changelog](intent-families-changelog.md).

Tests : `server/tests/request-decomposition-policy.test.js` (9 cas, dont #24).
#### Extension catalogue (v1.3+ — même contrat)

Unités candidates à ajouter avec la **même** logique inventaire + satisfiable + préemption :

| `unitType` prospect | Capacité locale | Notes |
|---------------------|-----------------|-------|
| *(météo actuelle)* | *patron `current_web_fact`* | *§ Patrons transverses — pas unité multi_unit* |
| `calculate_request` | éval arithmétique déterministe | ex. « calcule 2+2 » |
| `convert_request` | conversion unités connues | température, devises si taux local |
| `definition_request` | glossaire local / fiche courte | avant full pipeline |

Règle invariante : **si on sait faire à coup sûr, on répond ; on n'envoie pas une requête simple dans un couloir composite qui se croit obligé de clarifier.**

Règle : décomposer d'abord, router chaque unité ensuite — pas de guard spécial par formulation.

## Patrons transverses non-familiaux

> **Invariant** : pas d'id dans `intentFamilyRegistry` ; policy + short-circuit + guards.
> Même discipline que le principe #7 : satisfiable → déterministe, ou web prioritaire → fallback honnête.

### Frontières entre couches

| Question | Réponse normative |
|----------|-------------------|
| `context_reference` vs `subject_reference_resume` ? | `context_reference` **enrichit** `pipelineQuery` (kimono, traduction dérivée). `subject_reference_resume` **arbitre** nouveau sujet / reprise / ambigu **avant** familiarity et factual. |
| Pourquoi pas une famille `weather_*` ? | Promesse = fait actuel web ; couloir reste `simple_factual_lookup` ; évite explosion familiale. |
| Session vierge + « reprendre » ? | `applyVirginSessionResumeGuard` : pas de `contextual_resume` si historique non exploitable. |
| Web échoue sur `current_web_fact` ? | Message honnête rapide ; pas de raisonneur lourd silencieux (ADR-011 + orchestrateur). |

### 11.1 — `context_reference` (v1.1.6)

**Promesse** : enrichir `pipelineQuery` avant routage métier.

Couche exécutée dans `agentPipeline.js` avant `evaluateJustIntent(pipelineQuery)`.
Voir annexe B ci-dessous pour shells, resolver et signaux `[CONTEXT_REF]`.

### 11.2 — `subject_reference_resume` (lot #34b)

**Promesse** : distinguer nouveau sujet explicite, reprise session et référence implicite non résolue.

| Résolution | Couloir |
|------------|---------|
| Nouveau sujet | `familiarity_domain_overview_deterministic` |
| Reprise session (`contextual_resume`) | `subject_reference_resume_deterministic` |
| Implicite ambigu / non résolu | `subject_reference_clarify` |

**Déclenchement** : shells disponibilité domaine (« t'y connais en », « tu as des infos sur », « on peut parler de », « sinon s'agissant de »…).

**Fichiers** : `sessionSubjectReferenceGuards.js`, `subjectReferenceResumePolicy.js`, `intentShortCircuit.js` (amont).

**Tests** : `server/tests/subject-reference-resume-policy.test.js`.

**Garde session vierge** : `applyVirginSessionResumeGuard` — pas de « On peut reprendre sur… » sans historique exploitable (batterie #34b).

### 11.3 — `familiarity_domain_overview` (lot #34)

**Promesse** : répondre à la disponibilité sur un domaine sans bascule `simple_factual_lookup` ni template géo/histoire.

**Couloir** : `familiarity_domain_overview_deterministic`.

**Fichiers** : `familiarityIntentGuards.js`, `familiarityDomainOverviewPolicy.js`.

**Tests** : `server/tests/familiarity-domain-overview-policy.test.js`.

### 11.4 — `current_web_fact` (lot #36 météo · #38a trafic · #38b/c planifiés)

**Promesse** : fait **actuel** via SERP gouvernée — pas crawl profond, pas portail web générique.

**Règle d'or** : web uniquement quand la valeur attendue **change dans le temps** et que l'utilisateur demande l'**état actuel** (fraîcheur explicite : `maintenant`, `aujourd'hui`, `en ce moment`…).

**Slots communs** : `fact_type` · `subject` · `metric` · `time_scope` (`now` | `today`).

| `fact_type` | Lot | Statut |
|-------------|-----|--------|
| `weather` | #36 | livré (`weatherCurrentRequestPolicy`) |
| `traffic` | #38a | livré (`trafficCurrentRequestPolicy`) |
| `rate` | #38c | planifié |
| `schedule` | #38b | planifié |

**Exclusions transverses** (`currentWebFactIntentGuards.js`) :
- pas de fraîcheur explicite ;
- narratif / passé ;
- document collé / synthèse ;
- breadth pédagogique → `pedagogy_soft_overview` ;
- how-to / procédure ;
- fait encyclopédique stable → factual local ;
- **mécanisme / définition** (« c'est quoi un taux », « explique le trafic routier ») même si le mot-clé métier est présent.

**Couloir** : `simple_factual_lookup` + `deferToFullPipeline` + `preferWebResearch` + `currentWebFactWebQuery` (routeur `currentWebFactPolicy.js`).

**Fallback** : `buildCurrentWebFactRecoveryMessage` — réponse honnête rapide, pas de raisonneur lourd (`current_web_fact_fast_fallback`).

**Fichiers** : `currentWebFactIntentGuards.js`, `currentWebFactPolicy.js`, `weatherCurrentRequestPolicy.js`, `trafficCurrentRequestPolicy.js`, `knowledgeEnrichmentPolicy.js`, `SovereignOrchestrator.js`.

**Tests** : `weather-current-request-policy.test.js` (#36), `traffic-current-request-policy.test.js` (#38a).

**Politique légale** : `citadelle-vault/.../ADR-011-Politique-Scraping-Souverain.md`.

### 11.5 — `prompt_for_artifact` (lot #37)

**Promesse** : fournir un prompt structuré prêt à copier (court + détaillé) pour générer un artefact ailleurs — pas l'artefact lui-même.

**Déclenchement** : shells « quel prompt utiliser pour », « donne-moi un prompt pour », « écris un prompt pour obtenir/créer » + type d'artefact résoluble + sujet/concept.

**Slots** : `artifact_type` (landing page, site web…), `subject`, `target_system` optionnel.

**Exclusions** :
- méta « c'est quoi un bon prompt » ;
- build direct (« crée une landing page ») → `html_project` / livraison HTML.

**Couloir** : `prompt_for_artifact_deterministic` — amont de `general/explain` et COMPOSER.

**Fichiers** : `promptForArtifactIntentGuards.js`, `promptForArtifactPolicy.js`, `intentShortCircuit.js`, `clarificationDecisionPolicy.js`, `genericGreetingGuards.js` (recovery).

**Tests** : `server/tests/prompt-for-artifact-policy.test.js` (batterie #37).

### 11.6 — `pedagogy_soft_overview` (lot #35)

**Promesse** : livrer un aperçu intro minimal utile sur des sujets vagues mais légitimes (histoire, géographie, sciences) — **répondre d'abord**, suffixe de ciblage ensuite.

**Déclenchement** : shells « parle-moi de », « explique-moi … en général », « dis-moi l'essentiel sur » + domaine résoluble + sujet nommé.

**Domaines** (ordre de couverture) : histoire → géographie → sciences générales.

**Exclusions** :
- curriculum scolaire (`pedagogical_overview`) ;
- initiation débutant (`beginner_topic_overview`) ;
- technique (`technical_overview`, ex. Redis) ;
- synthèse document (`document_synthesis` sur « l'essentiel » sans doc) ;
- familiarité domaine / subject_reference quand l'aperçu est demandé.

**Couloir** : `pedagogy_soft_overview_deterministic` (fiches locales) ou `pedagogy_soft_overview` (addon LLM structuré par domaine).

**Fichiers** : `pedagogySoftOverviewIntentGuards.js`, `pedagogySoftOverviewKnowledge.js`, `pedagogySoftOverviewPolicy.js`, `intentShortCircuit.js`, `clarificationDecisionPolicy.js`, `genericGreetingGuards.js`.

**Tests** : `server/tests/pedagogy-soft-overview-policy.test.js` (batterie #35).

### 11.7 — `lexicon_explain_light` (lot conversationnel)

**Promesse** : répondre directement à « tu connais X ? » (recognition) — définition courte, pas menu d'angles.

**Déclenchement** : `parseFamiliarityQuery` → `kind: recognition` + sujet nommé.

**Exclusions** :
- `familiarity_domain_overview` (domaine large : politique, PHP…) ;
- `subject_reference_resume` (shells explicites « infos sur », « parler de »…) ;
- `pedagogy_soft_overview`.

**Couloir** : `lexicon_explain_light` — `deferToLlm` + addon structuré (définition + contexte + exemple), **avant** `subject_reference_resume`.

**Fichiers** : `lexiconExplainLightPolicy.js`, `familiarityIntentGuards.js`, `sessionSubjectReferenceGuards.js`, `intentShortCircuit.js`, `clarificationDecisionPolicy.js`.

**Tests** : `server/tests/lexicon-explain-light-policy.test.js` (batterie football / coup du chapeau).

### 11.8 — `exploratory_conversation_light` (lot conversationnel)

**Promesse** : accueillir un thème ouvert sans forcer objectif/format — exploration, pas mandat livrable.

**Déclenchement** : shells « on part vers », « on discute de », « on explore », « partons vers »… **sans** verbe d'action livrable ni format explicite.

**Exclusions** :
- délégation recherche explicite (« va faire des recherches… ») → web / orchestrateur ;
- mandat livrable (« fais un plan », « prépare un document ») → `clarify_then_build` ou build.

**Couloir** : `exploratory_conversation_light` — `simple_fast` + addon (accueil + 2–3 pistes + question ouverte).

**Frame** : `isExploratoryTopicIntent` → `conversation.task.present = true` (évite faux `socialOnly` sur « ok on part vers… »).

**Fichiers** : `exploratoryConversationGuards.js`, `exploratoryConversationPolicy.js`, `conversationIntentFrame.js`, `intentShortCircuit.js`, `clarificationDecisionPolicy.js`.

**Tests** : `server/tests/clarification-stratification-policy.test.js` (batterie arts martiaux).

### 11.9 — `meta_assistant_behavior` (lot conversationnel)

**Promesse** : traiter le feedback UX sur l'assistant comme du méta-discours — pas une demande métier.

**Déclenchement** : critique comportement / clarification / réflexion (« tu penses qu'à l'avenir tu vas réfléchir… », « pourquoi tu réponds comme ça », « ton comportement est… »).

**Exclusions** : mandat hybride avec livrable explicite dans la même phrase → arbitrage `deliverableMandateGuards` (v1.3+).

**Couloir** : `meta_assistant_behavior_deterministic` — réponse courte honnête ; **pas** `clarification_gate`, **pas** orchestrateur souverain.

**Rapprochement** : complète `meta_feedback` (`conversationTurnType`) et `meta_conversation` (`metaConversationIntentGuards`) sans les remplacer.

**Fichiers** : `metaAssistantBehaviorGuards.js`, `metaAssistantBehaviorPolicy.js`, `conversationTurnType.js`, `clarificationDecisionPolicy.js`, `intentShortCircuit.js`.

**Tests** : `server/tests/clarification-stratification-policy.test.js`.

### 11.10 — Clarification contextuelle (`CLARIFICATION_DECISION_V1` affiné)

**Promesse** : clarifier **uniquement** sur ambiguïté bloquante de mandat livrable — pas sur exploration, méta, lexique ou continuité.

#### Hiérarchie cognitive (ordre de routage)

```
1. meta_assistant_behavior / meta_conversation
2. exploratory_conversation_light
3. lexicon_explain_light / continuité (full resume, follow-up)
4. social_deterministic (social pur)
5. mandat livrable flou → clarify_then_build (si shouldAllowClarifyThenBuild)
6. délégation recherche explicite → web / orchestrateur
7. explain answerable → simple_fast / general_knowledge (sans gate)
```

#### Matrice intent × contexte → pipeline

| Contexte | Signaux | Clarification | Pipeline |
|----------|---------|---------------|----------|
| Social pur | `socialOnly`, check-in | non | `social_deterministic` |
| Exploration thème | `on part vers`, pas verbe livrable | non | `exploratory_conversation_light` |
| Lexique « tu connais X » | `recognition` | non | `lexicon_explain_light` |
| Continuité / extension | `tout reprendre`, follow-up | non | `general_knowledge_continuity_carryover` |
| Méta comportement | critique UX assistant | non | `meta_assistant_behavior_deterministic` |
| Explain vague answerable | `general/explain`, pas mandat | non | `can_answer_now` → simple_fast |
| Mandat flou livrable | `fais` + format absent | **oui** | `clarification_gate` |
| Recherche déléguée | « va chercher / recherches sur » | non | web + COMPOSER |

#### `shouldAllowClarifyThenBuild` — activation `clarify_then_build`

| Condition | Clarification |
|-----------|---------------|
| Verbe livrable (`fais`, `crée`, `prépare`, `organise`, `produis`…) | autorisée si ambigu |
| Format explicite (`plan`, `pdf`, `document`, `page html`) | autorisée si ambigu |
| `general/explain` sans verbe livrable | **interdite** |
| Exploration / méta / lexique / continuité | **interdite** |
| `fais quelque chose` / déictique seul | **obligatoire** (blocking ambiguity) |

**Messages interdits** sur exploration / méta / lexique : `INSUFFICIENT_SIGNAL_REFUSAL`, `REPEATED_FALLBACK_REFUSAL`, template objectif/format de `clarification_gate`.

**Fichiers** : `clarificationDecisionPolicy.js`, `deliverableMandateGuards.js`, `modeResponseContracts.js`.

**Tests** : `clarification-stratification-policy.test.js`, `clarification-decision-policy.test.js`, `lexicon-explain-light-policy.test.js`.

#### Batteries canoniques (conversation arts martiaux + football)

| # | Tour utilisateur | `pipelinePath` attendu |
|---|------------------|------------------------|
| A1 | « salut nexxus » | `social_deterministic` |
| A2 | « ok on part vers des enseignements d'arts martiaux… » | `exploratory_conversation_light` |
| A3 | « des techniques d'art martiaux » | `can_answer_now` (pas gate) |
| A4 | « va faire des recherches… » | web + orchestrateur |
| A5 | « tu penses qu'à l'avenir tu vas réfléchir… » | `meta_assistant_behavior_deterministic` |
| F1 | « au football tu connais le coup du chapeau ? » | `lexicon_explain_light` |
| F2 | « hé bien si tu peux tout reprendre » | `general_knowledge_continuity_carryover` |

### 11.11 — `existing_source_analysis` (lot source locale)

**Promesse** : analyser/lire un fichier **existant** référencé par `file:///` ou chemin absolu — pas `web_html/create`.

**Règle d'or** : le support (`.html`) décrit le **média**, pas l'**action**.

**Couloir** : `existing_source_analysis_clarify_access` — contrainte d'accès local + options (joindre, coller, chemin runtime).

**Piège** : `normalizeFamiliarityQuery` détruit `file:///` → `resolveIntentDomain` et `isHtmlProjectDeliverable` utilisent la **requête brute**.

**Tests** : `existing-source-analysis-policy.test.js` (batterie Teams 365 HTML).

#### Cas hybrides (v1.3+ — à formaliser)

| Formulation | Lecture attendue |
|-------------|------------------|
| « tu réfléchis trop, mais aide-moi à préparer un plan de karaté » | méta + mandat → mandat prime si verbe/format explicite |
| « ok on explore, mais fais-moi déjà une petite synthèse » | exploration + exécution légère → `can_answer_now` + synthèse courte |
| « tu pourrais mieux répondre… commence par les bases des arts martiaux » | feedback + explain implicite → continuité ou lexique, pas gate |

### Coexistence `learning_request(X)` vs `information_seeking(X)`

| Signal | Formulation type | `task.kind` | Preempt |
|--------|------------------|-------------|---------|
| `information_seeking` | « je cherche des infos sur X » | `explain` | social |
| `learning_request` | « apprentissage de X », « plan d'apprentissage sur X » | `learn` | `compare_choose` |
| Pont TLP | `learning_request` + X technique (React, Redis…) | `learn` | → `technical_learning_path` |

Règle : **info-seeking sans ancre apprentissage** ; **learning_request sans « je cherche des infos »** sauf shell fort (« plan d'apprentissage »).

### Règles de non-régression (niveau **fort**)

- Toute requête `socialOnly` → jamais `simple_factual_lookup`
- `explique Redis` → `technical_overview`, pas `technical_learning_path`
- `maîtriser React` / fiches → `technical_learning_path`, pas `technical_overview`
- `devenir développeur` → `career_learning_path`, pas `technical_learning_path`
- Tests : `conversation-intent-frame.test.js`, `request-intent-frame.test.js`, matrice philosophie

### Évolution progressive (v1.1 → v1.2)

| Lot | Extension |
|-----|-----------|
| **v1.1 (actuel)** | Social + `learn` / `explain` / `career_path` |
| v1.2 | `pedagogical_overview`, `beginner_topic_overview` |
| v1.3 | `debug`, `compare`, `procedure` dans `task.kind` |
| v1.4 | Brancher le routage short-circuit sur `familyHint` (shadow puis actif) |
| v1.5 | justIntent lit le frame en amont ; traces `frame:*` en telemetry |

**Ne pas** ajouter de regex par reformulation : enrichir les **axes** et réutiliser les guards existants.

### 11.12 — `presentation_outline` (slot-filling, v1.1.2)

**Promesse** : produire un **sommaire pédagogique** (titres, sous-titres, modules, durée) pour une présentation slides — pas une webapp Forge, pas un deck PPTX binaire, pas une clarification bloquante si le patron est complet.

**Niveau d'abstraction** : la route ne dépend **pas** du nom du produit (`Teams365`, `Excel`, `Notion`…) mais d'une **classe de requête** stable. Les instanciations concrètes sont des **échantillons de validation**, pas des cas spéciaux codés en dur.

#### Patron canonique (intent + slots)

```
presentation_outline(
  subject = X,              # slot interchangeable
  structure = M × H,        # ex. 6 × 4h (optionnel)
  pedagogical = true,       # sommaire + scénario pédagogique explicite
  deliverable = slides      # plan / outline, pas fichier pptx
)
```

**Forme linguistique type** :

> fait un plan pour la création d'une présentation en slides de **{X}** avec sommaire, titres, sous-titres, scénario pédagogique [durée **M × H**]

| Slot | Extraction | Obligatoire |
|------|------------|-------------|
| `subject` (`X`) | `extractPresentationSubject()` — `application X`, `slides de X` | recommandé (confiance `high` si présent) |
| `moduleCount` / `hoursPerModule` | `extractPresentationSchedule()` — `6 * 4h`, `24h` | non |
| `pedagogical` | signaux `sommaire`, `scénario pédagogique`, `titres`, `sous-titres` | oui (via `isPresentationOutlineSignal`) |
| `deliverable` | slides / présentation (pas `fichier pptx`) | oui |

#### Route attendue (runtime)

| Étape | Valeur |
|-------|--------|
| `justIntent` | `presentation · create · slides` (`build_v1`) |
| Clarification | `can_answer_now` — pas de gate si patron complet |
| `shortCircuitPath` | `presentation_outline` |
| Contrat | `PRESENTATION_OUTLINE` (préempte `FORGE_WEBAPP_BUILD`) |
| Pipeline | `simple_fast` + consigne anti-troncature (sommaire seul dans le tour) |
| **Interdit** | `FORGE_WEBAPP_BUILD`, `CODE_DELIVERY_V1`, orchestrateur lourd |

#### Frontière : même mot « excel », deux lectures

| Requête | Lecture | Route |
|---------|---------|-------|
| Patron complet avec `X = excel` | `presentation_outline(subject=excel, …)` | `presentation_outline` |
| Mot seul `excel` | `data · structure · spreadsheet` | `simple_fast` générique — **pas** cette famille |

La distinction est **structurelle** (patron intentionnel complet vs token isolé), pas lexicale sur le produit.

#### Batterie de stabilité (preuve de généralisation)

Même template, `X` variable :

- `teams365` → `PRESENTATION_OUTLINE`, slots `6×4h`
- `excel` → idem
- `notion` → idem

Fichiers : `presentationOutlineIntentGuards.js`, `presentationOutlineComposer.js`, `presentation-outline-routing.test.js`.

#### Règle doctrine

> Quand la phrase correspond au patron **plan de présentation slides de X + structure pédagogique explicite**, le système **doit** router vers `presentation_outline`, extraire `X` comme slot, et générer le contenu domaine-spécifique **après** le routage — jamais l'inverse.

---

## Annexe A — Traduction (`translation_request`)

### Famille `translation_request` (v1.1.4–v1.1.5)

**Promesse** : transformer un texte source vers une langue cible, sans web ni orchestration générale.

#### Shell primaire (texte explicite dans la requête)

Détecté par `isTranslationShell` (`translationIntentGuards.js`) :

| Motif lexical | Exemples canoniques |
|---------------|---------------------|
| `traduis` / `traduire` | « traduis ce texte en anglais : … » |
| `traduction de/en` | « traduction de cette phrase en espagnol » |
| `je veux/voudrais traduire` | « je veux traduire la phrase suivante en espagnol : … » |
| `mets … en` | « mets ce texte en allemand » |

**Prêt pour pipeline** (`isTranslationRequestReady`) : shell primaire **+** langue cible **+** texte source extrait (`:` / guillemets / queue après la langue).

| Signal | Effet |
|--------|-------|
| `task.kind = translate` | frame + `domain.target` = langue cible |
| `translation_pipeline` | texte + langue → SIMPLE_FAST direct, **pas de web** |
| `translation_clarify` | shell sans texte ou sans langue |
| `preempt:translation_request` | **translate > social** même si le texte cité contient « Bonjour / comment allez-vous » |

Telemetry : `[TRANSLATION_ORCH]` — `target_language`, `text_present`, `text_length_bucket`, `style_requested`, `requires_clarification`.

> Batterie **#19** — voir [changelog](intent-families-changelog.md).

#### Traduction multi-cibles (v1.1.7)

Plusieurs langues dans une même requête : `en espagnol, en allemand, en arabe et en chinois`.

**Décomposition** (`buildTranslationRequestPlan`) :

| Champ | Exemple |
|-------|---------|
| `text` | phrase source unique |
| `targetLanguages` | `["es","de","ar","zh"]` |
| `multiTarget` | `true` |
| `mode` | `multi_target_batch` |
| `executionMode` | `batch` (1 passe LLM structurée ; `fanout` réservé v1.2) |
| `requestUnits` | 4 unités `translate` homogènes, même `sourceText` |

| Signal | Effet |
|--------|-------|
| `extractTargetLanguages()` | toutes les langues — pas seulement la première |
| `translation_pipeline` | `targetLanguageCount === 1` |
| `translation_multi_target` | `targetLanguageCount > 1` |
| `[TRANSLATION_ORCH]` | `execution_mode`, `request_unit_count`, `plan_mode` |
| Mode `TRANSLATION` | sortie `**Espagnol :**` / `**Allemand :**` / … |

**Faux composite** : `merci par avance` en clôture → `courtesyClosing`, pas salutation.

Extension future : `multi_step_request` pour unités hétérogènes (traduction + reformulation + ton).

#### Shell dérivé (source = sortie précédente de la session)

Détecté par `isTranslationDerivedShell` **+** langue cible (`isTranslationDerivedRequest`).

| Motif lexical | Exemple utilisateur |
|---------------|---------------------|
| `la phrase précédente` | « la phrase précédente mais en allemand » |
| `la même phrase` | « la même phrase en anglais » |
| `la phrase déjà traduite` | « la phrase déjà traduite en italien » |
| `cette phrase` | « cette phrase en portugais » |
| `maintenant en` | « maintenant en allemand » |
| `pareil en` / `idem en` | « pareil en espagnol » |
| `la traduction précédente` | « la traduction précédente en anglais » |
| `but en` / `mais en` | « … mais en allemand » (suite conversationnelle) |

**Réancrage explicite** (`TRANSLATION_REANCHOR_SHELL_RE`) — après clarification générique ou refus :

| Motif lexical | Exemple utilisateur |
|---------------|---------------------|
| `traduction d'une phrase` | « ma demande principale était la traduction d'une phrase… » |
| `traduire la/une phrase` | « je voudrais que tu traduises la phrase en allemand » |
| `demande principale … traduction` | « ma demande principale était la traduction… » |
| `je voudrais que tu (la) tradui…` | « je voudrais que tu la traduises en allemand » |

#### Résolution de la source (historique session)

`extractTranslationSourceFromHistory(history)` — ordre de priorité :

1. **Dernière sortie assistant** non boilerplate (`TRANSLATION_SOURCE_SKIP_RE` : « je vois la piste », « pas encore la destination », etc.)
2. **Sinon** : dernier payload traduction extrait d'un message utilisateur antérieur

Enrichissement : `buildTranslationEffectiveQuery(query, sourceText)` →

```
Traduis en {langue} : {texte résolu}
```

Signaux dérivés :

| Signal | Valeur |
|--------|--------|
| `previous_output_as_source` | `true` si shell dérivé |
| `isTranslationPipelineReady(query, history)` | primaire **ou** dérivé avec source résolue |
| `usesPreviousOutputAsTranslationSource` | alias du shell dérivé |

**Gates** : `isTranslationPipelineReady` court-circuite `clarify_then_build` et bloque `repeated_fallback_refusal` dans `agentPipeline.js`.

> Batterie **#20** — voir [changelog](intent-families-changelog.md).

Implémentation : `server/src/agent/utils/translationIntentGuards.js`.
---

## Annexe B — Références contexte session (`context_reference`, v1.1.6)

### Résolution de références contexte session (v1.1.6)

**Promesse transversale** : résoudre les renvois implicites à la conversation courante **avant** le choix de famille métier.

> Ce n'est pas une famille d'intent isolée : c'est une **couche d'enrichissement** exécutée dans `agentPipeline.js` avant `evaluateJustIntent(pipelineQuery)`.

#### Position dans la chaîne

```
Requête brute
  → resolveSessionContextReference(query, history)   ← v1.1.6
  → pipelineQuery = enrichedQuery | query
  → justIntent / clarification gate / short-circuit
  → famille métier (translation, info-seeking, …)
```

Si la référence est applicable mais non résolue → réponse immédiate `context_reference_not_found` (pas de LLM, pas de `repeated_fallback_refusal`).

#### Types de référence (`reference_type`)

| Type | Shells reconnus | Cible extraite |
|------|-----------------|----------------|
| `previous_translation` | shell dérivé traduction **ou** « la phrase/le message précédent » **+** langue | code langue (`de`, `en`, …) |
| `previous_message` | « la phrase précédente » **sans** langue cible | `previous_message` |
| `subject_recall` | « tu te rappelles de/du/des/sur X » | sujet `X` |
| `resume_subject` | « reprends / reviens sur / continue sur ce qu'on disait (sur) X » | sujet `X` |

#### Catalogue des shells (`contextReferenceIntentGuards.js`)

**Rappel de sujet** (`SUBJECT_RECALL_SHELL_RE`) :

- « tu te rappelles de King of Avalon ? »
- « tu te souviens du tigre ? »
- « te rappelles-tu de Docker ? »

**Reprise de fil** (`RESUME_SUBJECT_SHELL_RE`) :

- « reprends ce qu'on disait sur le kimono »
- « reviens sur le kimono »
- « continue sur ce qu'on a dit concernant React »

**Référence au message précédent** (`PREVIOUS_MESSAGE_SHELL_RE`) :

- « la phrase précédente » / « le message précédent »
- « dernière phrase » / « dernier message »
- *(avec langue → bascule `previous_translation` via guards traduction)*

#### Algorithme de résolution (`sessionContextReferenceResolver.js`)

| Étape | Comportement |
|-------|--------------|
| 1. Traduction dérivée | `extractTranslationSourceFromHistory` + langue → `enrichedQuery` traduction |
| 2. Sujet `X` | `findSessionMatchForTarget` : fenêtre **6 derniers tours** (`recent_turns`), puis **24 tours** (`session_search`) |
| 3. Match trouvé | `buildSubjectResumeQuery` : requête utilisateur d'origine si retrouvable, sinon `quelles informations as-tu sur {X}` |
| 4. Pas de match | `buildContextReferenceNotFoundMessage(X)` |

**Matching session-local** : inclusion directe, forme compacte (`kingofavalon` ↔ `King of Avalon`), ou recouvrement tokeniel (≥ 2 tokens ou tous si cible courte).

**Boilerplate ignoré** : messages assistant de clarification/refus ne servent ni de source traduction ni de match sujet.

#### Contrat de signaux

| Signal | Description |
|--------|-------------|
| `context_reference_detected` | `isContextReferenceRequest(query)` |
| `reference_type` | voir tableau ci-dessus |
| `reference_target` | sujet `X` ou code/langue cible |
| `reference_resolved` | `true` / `false` |
| `resolution_source` | `recent_turns` \| `session_search` \| `none` |
| `previous_output_as_source` | `true` pour `previous_translation` |
| `enrichedQuery` | requête explicite injectée dans `pipelineQuery` |

Telemetry : `[CONTEXT_REF]` — événement `context_reference_resolution`.

#### Réponses normalisées

| Cas | `pipelinePath` | Message |
|-----|----------------|---------|
| Sujet introuvable | `context_reference_not_found` | « Nous n'avons pas parlé de {X} dans la conversation actuelle. Redonne-moi le contexte et je reprends. » |
| Traduction dérivée sans source | `context_reference_not_found` ou `translation_clarify` | clarification traduction ciblée |

#### Interaction avec `repeated_fallback_refusal`

`isContextReferenceRequest(query)` **neutralise** le refus répété même si la clarification gate s'active — la requête n'est pas traitée comme une ambiguïté métier générique.

Combiné avec `isTranslationPipelineReady` pour les suites de traduction.

#### Routage post-résolution (exemples)

| Requête enrichie | Famille / couloir attendu |
|------------------|---------------------------|
| `Traduis en allemand : Sigue el progreso…` | `translation_pipeline` |
| `quelles informations aurais tu du jeu kingofavalon` | `information_seeking_full_pipeline` |
| `infos sur le kimono` | `information_seeking_full_pipeline` |

#### Extensions futures (hors v1.1.6)

Même couche, familles à brancher :

- `learning_request` : « reviens sur le plan précédent »
- `compare_choose` : « reprends la comparaison d'hier »
- `procedure` : « refais la procédure qu'on avait »

Règle : enrichir les **types** et le resolver, pas une regex par reformulation.