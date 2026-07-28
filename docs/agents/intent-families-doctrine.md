# Doctrine des familles d'intent — La Citadelle

Charte normative (lisible en ~10 min). Complète le registre exécutable
`server/src/agent/policies/intentFamilyRegistry.js` sans le remplacer.

**Voir aussi** :
- [IntentFrame et décomposition](intent-frame-and-decomposition.md)
- [Catalogue familles et contraintes](family-catalog-and-constraints.md)
- [Changelog lots et batteries](intent-families-changelog.md)


## Chaîne de vérité

```
Requête → IntentFrame → famille (intent) → slots → coverage → connector → delivery → réponse
```

| Couche | Rôle | Source de vérité |
|--------|------|------------------|
| **IntentFrame** | Représentation structurée amont (social, tâche, domaine, famille) | `conversationIntentFrame.js`, `requestIntentFrame.js` |
| **Famille** | Promesse utilisateur + routage short-circuit | `intentFamilyRegistry.js` + guards |
| **Slots** | Variables structurées extraites de la requête | `*IntentGuards.js`, parsers |
| **Blueprint** | Progression pédagogique par stack (sous-type) | `technicalLearningBlueprints.js` |
| **justIntent** | Signal traces / addon prompt — **dérivé du frame** quand disponible | `justIntentDetectionPolicy.js`, `projectFrameToJustIntentHints()` |
| **Connector** | Enrichissement web / telemetry par famille | `connectorRegistry.js`, Phase C |

La famille répond à **« quel job l'utilisateur confie au système ? »**  
Le blueprint répond à **« quelle progression standard pour cette stack ? »**  
L'IntentFrame répond à **« comment décomposer le message avant de choisir une famille ? »**  
justIntent répond à **« quel cadrage produit pour les logs et le prompt ? »** — il ne doit pas contredire la famille servie.

---

## Famille vs couloir vs blueprint

### Famille d'intent

Une **famille** est une promesse stable, testée, avec :

- un **id** unique (`technical_learning_path`, `technical_overview`, …) ;
- un **detect** exclusif (une requête canonique → une seule famille) ;
- des **slots** métier ;
- un **composer** et une **politique de fallback** ;
- des **requêtes canoniques** dans la matrice de tests.

**Ouvrir une nouvelle famille** quand la promesse, les slots et le mode de livraison changent de nature — pas quand la stack cible change.

Exemples de promesses distinctes :

| Famille | Promesse |
|---------|----------|
| `technical_learning_path` | Plan / fiches pour **maîtriser** une stack |
| `technical_overview` | Comprendre **c'est quoi X** (aperçu ponctuel) |
| `career_learning_path` | Parcours **métier / reconversion** |
| `debug_diagnostic` | **Incident** et diagnostic |
| `compare_choose` | **Arbitrage** entre options |

### Couloir

Un **couloir** est le chemin pipeline effectivement emprunté (`shortCircuitPath`).  
En v1, `technical_learning_path` est un **couloir unique** pour tout apprentissage technique structuré — on n'éclate pas HTML/CSS/JS en familles séparées.

### Blueprint

Un **blueprint** est un plan canonique (4–8 modules) rattaché à une stack reconnue **à l'intérieur** d'un couloir.

- Registre : `TECHNICAL_LEARNING_BLUEPRINTS` (15 stacks en v1).
- Résolution : `normalizeTechnicalLearningTarget` → `resolveTechnicalLearningBlueprint`.
- Si aucun blueprint : fallback générique propre (socle → pratique), jamais un squelette interchangeable pour les stacks reconnues.

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

## Quand ouvrir une nouvelle famille (non)

Ne **pas** créer de famille par techno. Signaux d'une vraie nouvelle famille :

- changement de **livrable** (plan de fiches ≠ page web ≠ dissertation) ;
- changement de **objectif** (apprendre ≠ expliquer ≠ débugger ≠ comparer) ;
- changement de **mode de delivery** (deterministic vs generative vs web RAG) ;
- **exclusion mutuelle** testée avec les familles existantes.

Express / Fastify : blueprints dédiés (frameworks HTTP Node) — voir § **Serveur Node** ; pas une nouvelle famille tant que la promesse reste « maîtriser un stack technique ».

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

## Niveaux de sévérité des règles

Chaque règle de gouvernance appartient à un **niveau de sévérité**.  
Cela clarifie ce qu'une violation implique en CI et en revue de lot.

| Niveau | Violation = | Exemple canonique | Test CI |
|--------|-------------|-------------------|---------|
| **Interdit** | build rouge, bug de prod potentiel | stack reconnue → jamais fallback « Mécanismes clés » | `intent-families-philosophy-constraints` § interdit |
| **Obligatoire** | bug de routage / traces incohérentes | learn vs build → `preempt:technical_learning_path` | § obligatoire |
| **Fort** | régression de frontière familiale | une requête canonique → une seule famille | § fort |
| **Recommandé** | dette qualité contrôlée | blueprint avec `llmAddonLine` pour guider le LLM | § recommandé (non bloquant routage) |
| **Facultatif** | enrichissement / télémétrie | connector web Phase C selon famille | § facultatif (informatif) |

### Règle d'évolution

**Nouvelle règle doc → assignation à un niveau + test associé avant merge.**

Exemples de classification pour un lot futur :

| Règle proposée | Niveau | Pourquoi |
|----------------|--------|----------|
| « Serveur Node » doc-only (regroupe Node/Express/Fastify en doc, sans nouvelle famille) | **Recommandé** | clarifie la doc, ne change pas le routage — voir § Serveur Node |
| Nouveau blueprint Fastify avec priorité sur Node | **Obligatoire** | erreur de résolution si mal ordonné |
| Créer une famille `html_learning` par techno | **Interdit** (anti-pattern) | explosion de familles, promesse identique |
| Enrichissement web sur `compare_choose` | **Facultatif** | améliore la réponse, pas le couloir |

Les assertions par niveau vivent dans
`server/tests/intent-families-philosophy-constraints.test.js` (bloc `niveaux de sévérité`).

---

## Checklist avant un nouveau lot

### Nouvelle règle (tout lot)

- [ ] Niveau de sévérité choisi (interdit / obligatoire / fort / recommandé / facultatif)
- [ ] Assertion ou cas canonique ajouté au test philosophie si interdit / obligatoire / fort

### Nouveau blueprint (stack)

- [ ] Modules 4–8 avec objectif, concepts, pratique, critère « je maîtrise »
- [ ] Aliases + priorité explicite vs blueprints voisins
- [ ] Retrait des alias ambigus des blueprints adjacents
- [ ] Cas canonique dans `intentFamilyRegistry.js`
- [ ] Tests : blueprint dédié, pas de fallback générique
- [ ] Tests de frontière (ex. Node ≠ JS, JSX ≠ React)

### Préemption justIntent

- [ ] Faisceau positif (artefact pédagogique + apprentissage + stack)
- [ ] Faisceau négatif (livrables explicites web/code/doc)
- [ ] Traces cohérentes (`preempt:technical_learning_path`)
- [ ] Addon justIntent vide quand preempt

### Nouvelle famille (rare)

- [ ] Promesse une phrase, disjointe des familles existantes
- [ ] Matrice : requête canonique n'active qu'une famille
- [ ] `shortCircuitOrder` sans doublon
- [ ] Connector / Phase C si applicable

---

## Contraintes exécutables

La philosophie n'est pas seulement descriptive : le fichier
`server/tests/intent-families-philosophy-constraints.test.js` vérifie que
chaque principe directeur possède au moins une assertion en CI.

Si un principe est ajouté à ce document, ajouter la couverture correspondante
dans ce test (ou un cas canonique dans le registre) avant de merger.

---

## Principes directeurs (résumé)

1. **Une promesse = une famille** — pas une famille par techno.
2. **Une stack fréquente = un blueprint** — dans le couloir existant.
3. **Le plus spécifique gagne** — hiérarchie sémantique, pas premier match lexical.
4. **Traces = vérité métier** — justIntent aligné ou preempt, jamais trompeur.
5. **Négatifs aussi soignés que positifs** — chaque règle a des contre-exemples testés.
6. **IntentFrame avant famille** — décomposer structuré, router ensuite ; pas l'inverse.
7. **Satisfiable → déterministe** — multi-unit servable localement préempte les couloirs composites ; how-to qualifié `simple_benign_local` seulement ; sinon clarification ciblée ou orchestration.

### Principes → renvois (fichiers 2 et 3)

| # | Principe | Où le lire en détail |
|---|----------|----------------------|
| 1 | Une promesse = une famille | [Catalogue § familles v1](family-catalog-and-constraints.md) ; [Frame § Patrons transverses](intent-frame-and-decomposition.md) (invariant : pas d'id registry) |
| 2 | Stack = blueprint | [Catalogue § blueprints / Serveur Node](family-catalog-and-constraints.md) |
| 3 | Le plus spécifique gagne | Ce doc § Hiérarchie sémantique ; [Frame § priorités IntentFrame](intent-frame-and-decomposition.md) |
| 4 | Traces = vérité métier | Ce doc § justIntent vs couloir ; [Frame § schéma IntentFrame](intent-frame-and-decomposition.md) |
| 5 | Négatifs soignés | Ce doc § garde-fous négatifs ; `intent-families-philosophy-constraints.test.js` |
| 6 | IntentFrame avant famille | [Frame § IntentFrame v1.1](intent-frame-and-decomposition.md) (document entier) |
| 7 | Satisfiable → déterministe | [Frame § décomposition + Patrons transverses](intent-frame-and-decomposition.md) |

Version alignée sur `INTENT_FAMILY_REGISTRY_V1`, `TECHNICAL_LEARNING_BLUEPRINTS_V1`, `REQUEST_INTENT_FRAME_V1.1`, `SESSION_CONTEXT_REFERENCE_V1`, `REQUEST_DECOMPOSITION_V1.2.1` et patrons transverses #34–#36 (juillet 2026).