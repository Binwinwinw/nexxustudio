# Catalogue des familles et contraintes — La Citadelle

Familles promises, blueprints, exemples canoniques, cartographie code ↔ tests.

**Voir aussi** :
- [Doctrine / charte](intent-families-doctrine.md)
- [IntentFrame et décomposition](intent-frame-and-decomposition.md)
- [Changelog lots et batteries](intent-families-changelog.md)



## Catalogue des familles v1

| Famille | Promesse | Couloir typique | Web |
|---------|----------|-----------------|-----|
| `technical_learning_path` | Maîtriser une stack (plan / fiches) | `technical_learning_path` | non |
| `technical_overview` | C'est quoi X (aperçu ponctuel) | `technical_overview` | optionnel |
| `career_learning_path` | Parcours métier / reconversion | `career_learning_path` | non |
| `debug_diagnostic` | Incident et diagnostic | `debug_diagnostic` | optionnel |
| `compare_choose` | Arbitrage entre options | `compare_choose` | optionnel |
| `translation_request` | Texte → langue cible | `translation_pipeline` / `translation_multi_target` | non |
| `information_seeking` | Infos ciblées sur entité X | `information_seeking_full_pipeline` | oui si escalade |
| `social` | Check-in / salutation | `social_deterministic` | non |
| `datetime` | Heure / date locale | `datetime_deterministic` | non |
| `how_to` | Procédure qualifiée | `how_to_simple_local` / clarify / orchestration | selon qualification |
| `simple_factual_lookup` | Fait simple local | `simple_factual_lookup` | escalade / `current_web_fact` |

### Couloirs issus de patrons transverses (non-familiaux)

> **Ces entrées ne sont pas des familles** : absentes de `intentFamilyRegistry.js`.
> Ce sont des **policies + short-circuits** documentés dans [Frame § Patrons transverses](intent-frame-and-decomposition.md).

| Patron | Couloir (`shortCircuitPath`) | Famille registry ? |
|--------|------------------------------|--------------------|
| `familiarity_domain_overview` | `familiarity_domain_overview_deterministic` | non |
| `subject_reference_resume` | `subject_reference_resume_deterministic` / `subject_reference_clarify` | non |
| `current_web_fact` | `simple_factual_lookup` + web prioritaire (`weatherWebQuery`) | non (réutilise couloir factual) |
| `prompt_for_artifact` | `prompt_for_artifact_deterministic` | non |
| `pedagogy_soft_overview` | `pedagogy_soft_overview_deterministic` / `pedagogy_soft_overview` (LLM) | non |
| `lexicon_explain_light` | `lexicon_explain_light` (LLM guidé) | non |
| `exploratory_conversation_light` | `exploratory_conversation_light` (simple_fast) | non |
| `meta_assistant_behavior` | `meta_assistant_behavior_deterministic` | non |
| `existing_source_analysis` | `existing_source_analysis_clarify_access` | non |
| `presentation_outline` | `presentation_outline` (simple_fast, sommaire) | non |

**Doctrine slot-filling** — voir [Frame §11.12](intent-frame-and-decomposition.md#1112--presentation_outline-slot-filling-v112) : le sujet `X` (Teams365, Excel, …) est interchangeable ; la route dépend du **patron intentionnel**, pas du nom produit.

| `current_web_fact` (trafic #38a) | `simple_factual_lookup` + web (`trafficWebQuery`) | non (réutilise couloir factual) |
| `context_reference` | enrichissement `pipelineQuery` → famille métier | non |
| `multi_unit` | `multi_unit_deterministic` | non |


---

### Forme de réponse (présentation)

Le contenu pédagogique vit dans le blueprint ; la **lisibilité** est imposée par
`formatTechnicalLearningPathPresentation()` dans `technicalLearningPathComposer.js` :

1. Intro — reformulation de la demande (« Tu veux maîtriser X… »)
2. **En bref** — vue d'ensemble numérotée
3. Modules détaillés — Objectif · À retenir · Fiche pratique · Auto-vérification · *Pour te tester* (max 2 questions/module) · *Ressource officielle* (optionnel, **1 lien https statique**/module, doc primaire — **15/15 stacks**)
4. **Comment avancer** — mode d'emploi du parcours

Niveau **recommandé** : contrat testé via `meetsTechnicalLearningPathPresentationContract()`.
Livraison **déterministe** (blueprint local) — pas de reformulation LLM sur les stacks documentées.

**Frontières vocabulaire (mini-questions)** — niveau **recommandé** : paires glissantes factorisées dans `server/tests/helpers/technicalLearningVocabularyBoundaries.js`, vérifiées par `technical-learning-vocabulary-boundaries.test.js`. Les tests pilotes par lot (`technical-learning-path-routing.test.js`) conservent les assertions positives (pièges caractéristiques) ; les assertions négatives croisées vivent dans le registre famille-wide.

---

---

## Quand spécialiser par blueprint (oui)

Ajouter ou étendre un blueprint quand **toutes** ces conditions sont vraies :

1. **Progression pédagogique standardisée** — on peut décrire 4–8 modules du socle à la pratique sans improvisation.
2. **Requêtes fréquentes naturelles** — les utilisateurs demandent « maîtriser X » / « fiches pour X ».
3. **Frontière sémantique claire** — X se distingue d'un blueprint voisin (pas un simple alias lazy).
4. **Tests de non-régression** — la stack reconnue ne retombe jamais sur « Mécanismes clés » / fallback générique.

**Exemples validés :**

- HTML, CSS, JavaScript, Node.js, Express, Fastify, TypeScript, React, JSX, Tailwind, Python, SQL, Docker, Git, JVM+JS.

**Node.js vs JavaScript** (frontière type) :

| | JavaScript | Node.js |
|---|------------|---------|
| Objet | Langage ECMAScript | Runtime V8 hors navigateur |
| Plan | Syntaxe, DOM, async langage | CLI, npm, fs, HTTP, env |
| Alias | `js`, `ecmascript` | `nodejs`, `node.js` — **pas** dans JS |

---

## Regroupement sémantique — serveur Node (doc-only)

**Niveau : recommandé** — clarifie la doc et la hiérarchie déjà codée ; ne modifie ni promesse, ni couloir, ni `normalizeTechnicalLearningTarget()`.

### Ce que « serveur Node » désigne

Regroupement **conceptuel** pour le backend JavaScript côté serveur : runtime Node, puis frameworks HTTP courants.  
Ce n'est **pas** une famille (`server_node_learning` = anti-pattern), ni un couloir, ni un blueprint fourre-tout.

Trois blueprints distincts, **même promesse** (`technical_learning_path` — maîtriser une stack) :

| Blueprint | Objet pédagogique | Frontière | Exemple de requête |
|-----------|-------------------|-----------|-------------------|
| `nodejs` | Runtime V8, CLI, npm, fs, HTTP bas niveau | ≠ langage JS pur, ≠ Express/Fastify | « maîtriser nodejs » |
| `express` | Routing, middleware, Router, structure API | ≠ runtime Node brut | « fiches pour express » |
| `fastify` | Schema-first, plugins, hooks, perf | ≠ Express, ≠ runtime Node brut | « apprendre fastify » |

### Échelle de spécificité (résolution)

Le plus spécifique gagne — ordre implémenté dans `normalizeTechnicalLearningTarget()` :

```
Fastify  →  Express  →  Node.js  →  JavaScript
(framework HTTP)  (framework HTTP)  (runtime)     (langage)
```

Cas composés : « express sur node » → blueprint **Express** (le framework prime sur le runtime mentionné en contexte).

Couverture CI (niveau **obligatoire** si cet ordre change) :

- `server/tests/technical-learning-blueprints.test.js` — frontières Node/Express/Fastify
- `server/tests/intent-families-philosophy-constraints.test.js` — hiérarchie sémantique

### Progression pédagogique conseillée (hors routage)

Ordre naturel pour un parcours « backend JS », sans imposer de séquence au pipeline :

1. **JavaScript** — syntaxe, async, bases du langage
2. **Node.js** — runtime, modules, npm, fs, serveur HTTP minimal
3. **Express** ou **Fastify** — framework HTTP choisi selon le besoin (Express : écosystème ; Fastify : schema/perf)

Chaque étape reste une requête indépendante ; le système route vers le blueprint le plus spécifique détecté.

### Ce que ce regroupement ne change pas

- Famille : toujours `technical_learning_path`
- Couloir : toujours `technical_learning_path`
- Préemption learn vs build : inchangée
- Connector : `local_generative` (pas de web forcé)

### Évolution future

| Changement | Niveau attendu |
|------------|----------------|
| Enrichir cette section doc | Recommandé |
| Alias doc « serveur node » sans toucher la normalisation | Recommandé |
| Nouveau framework HTTP (Hono, Koa…) | Nouveau **blueprint** + tests frontière — **obligatoire** pour la hiérarchie |
| Famille `server_node_*` | **Interdit** — scission par techno sans changement de promesse |

---

---

## Hiérarchie sémantique (priorité sur le premier match lexical)

Les collisions se règlent par **préemption du plus spécifique**, pas par accumulation de routes.

Ordre type pour `technical_learning_path` :

1. Recadrages hybrides (ex. JVM + JavaScript → `jvm_javascript`)
2. Spécialisations explicites (JSX avant React ; **Fastify → Express → Node.js** avant JavaScript — voir § Serveur Node)
3. Blueprint par alias normalisé
4. Fallback générique

### justIntent vs couloir final

Le couloir final (famille) fait foi pour la **réponse utilisateur**.  
justIntent sert aux **traces** et à l'addon prompt amont.

Règle : **« apprendre X » vs « livrer un artefact X »**

- Artefact pédagogique + objectif d'apprentissage + stack tech + **absence** de livrable explicite → `suppressesBuildIntentForTechnicalLearning`
- Effet traces : `general · plan · réponse` + `preempt:technical_learning_path` — pas `web_html/create` ni `code/generate`

Garde-fous **négatifs** obligatoires (contre-exemples dans les tests) :

- résumé exécutif sans stack tech → reste général / writing ;
- dissertation rédactionnelle → `writing` ;
- « créer une page HTML » → `web_html/create`.

---

---

## Fichiers de référence

| Sujet | Fichier |
|-------|---------|
| Registre familles v1 | `server/src/agent/policies/intentFamilyRegistry.js` |
| Guards apprentissage tech | `server/src/agent/utils/technicalLearningPathIntentGuards.js` |
| Blueprints stack | `server/src/agent/micro/replies/technicalLearningBlueprints.js` |
| Composer couloir | `server/src/agent/micro/replies/technicalLearningPathComposer.js` |
| Préemption build vs learn | `suppressesBuildIntentForTechnicalLearning()` |
| justIntent amont | `server/src/agent/policies/justIntentDetectionPolicy.js` |
| **IntentFrame conversationnel** | `server/src/agent/policies/conversationIntentFrame.js` |
| **IntentFrame requête (v1.1)** | `server/src/agent/policies/requestIntentFrame.js` |
| HTML build (séparé) | `server/src/agent/policies/htmlProjectDeliveryPolicy.js` |
| Tests matrice | `server/tests/intent-family-routing-matrix.test.js` |
| Tests blueprints | `server/tests/technical-learning-blueprints.test.js` |
| Tests préemption | `server/tests/technical-learning-build-preemption.test.js` |
| **Contraintes philosophie (doc → tests)** | `server/tests/intent-families-philosophy-constraints.test.js` |
| **Tests IntentFrame social** | `server/tests/conversation-intent-frame.test.js` |
| **Tests IntentFrame métier** | `server/tests/request-intent-frame.test.js` |
| **Guards traduction** | `server/src/agent/utils/translationIntentGuards.js` |
| **Guards références contexte** | `server/src/agent/utils/contextReferenceIntentGuards.js` |
| **Resolver contexte session** | `server/src/agent/utils/sessionContextReferenceResolver.js` |
| **Tests traduction** | `server/tests/translation-intent-guards.test.js` |
| **Tests références contexte** | `server/tests/context-reference-resolution.test.js` |
| **Décomposition gouvernée** | `server/src/agent/policies/requestDecompositionPolicy.js` |
| **Réponse multi-unit déterministe** | `server/src/agent/micro/replies/multiUnitReplyBuilder.js` |
| **Tests décomposition** | `server/tests/request-decomposition-policy.test.js` |
| **Batterie ambiguïté** | `server/tests/intent-frame-ambiguity-battery.test.js` (#1–#23) + #24 dans décomposition |

| **Patrons transverses #34–#36** | |
| Familiarity domain | `familiarityDomainOverviewPolicy.js` |
| Subject reference | `subjectReferenceResumePolicy.js`, `sessionSubjectReferenceGuards.js` |
| Météo / current_web_fact | `weatherCurrentRequestPolicy.js` |
| Tests #34–#36 | `familiarity-domain-overview-policy.test.js`, `subject-reference-resume-policy.test.js`, `weather-current-request-policy.test.js` |

---

## Contraintes exécutables

## Contraintes exécutables

La philosophie n'est pas seulement descriptive : le fichier
`server/tests/intent-families-philosophy-constraints.test.js` vérifie que
chaque principe directeur possède au moins une assertion en CI.

Si un principe est ajouté à ce document, ajouter la couverture correspondante
dans ce test (ou un cas canonique dans le registre) avant de merger.