# From input understanding to authoritative routing

**Nature** : diagnostic d’architecture. Pas une ADR. Pas un plan d’exécution.  
**Date** : 2026-09-09  
**Working tree** : local, en avance sur HEAD et sur `dev/PLAN.md` (MAJ 2026-08-31).  
**Relié** : [trace D-20260909](decisions/D-20260909-input-understanding-authority.md) · [plan de suite](plan-authoritative-input-understanding.md) · [canon](citadelle-input-invariants.md)

Les incidents live (orientation d’achat, n8n, traduction, phpMyAdmin) sont des **révélateurs**. Le problème général : une intention humaine insuffisamment structurée en amont laisse un vide ; des couches aval le remplissent avec une catégorie, un contrat ou un rail qui ne correspondent pas à l’acte demandé.

---

## 1. Chaîne réelle actuelle

Porte unique déclarée : `runAgentUnderstandingPhase` (`nexxusAgentCycle.js`).

```
requête brute
  → understandQuery          (segments + détecteurs de domaine G29)
  → requestFrame             (conversation + task.kind + domain.target)
  → turnComprehension        (projection ; entities fermées)
  → buildRequestWorkup
        intent_assessment
        evidence_requirement
        retrieval_decision
        response_commitment   (+ responseType C4.1)
  → JUST                     (shadow)
  → conversationMove
  → gate clarify
  → short-circuit            (pattern → path)
  → IntentStage.classifyIntent     ← 2e taxonomie
  → resolveIntentContract          ← fallback de classe
  → Sovereign / COMPOSER
  → ancrage / PRE_EMIT             (souvent après stream)
```

Canon : une chaîne amont, JUST shadow, packet → copie → arrêt.  
Doctrine cycle : `intent_assessment → evidence_requirement → retrieval_decision → response_commitment`.

Le cycle **existe**. Il n’écrit pas encore un **acte utilisateur** autoritaire. C4 a nommé le trou « pattern → rail sans correspondance ». C4.1 n’a ajouté que le **job de reply** (`direct` / `clarify` / `overview` / `scoping`), pas l’acte (*conseiller* vs *expliquer* vs *créer*).

---

## 2. Point de perte de sens

**Perte primaire** — `understandQuery` + `analyzeRequestIntentFrame`, avant JUST et avant le SC.

Si aucun détecteur de segment ne fire :

- `primaryDomain = unknown`
- `intents = []`
- `responseStrategy = full_pipeline`
- `requestFrame.task.kind = null` (hors social / learn / explain / translate / career)

À partir de là, plus rien n’a le **sujet + l’acte + le contexte fourni**.

**Perte secondaire** — `IntentStage` + `resolveIntentContract`.  
Une classe aval (`expert_task`) est mappée sur le premier contrat qui liste cette classe. `CODE_INTENT` peut gagner **sans** `isCodeIntentRequest`. Le workup peut encore demander du web ; le contrat le coupe.

**Perte tertiaire** — émission.  
Ancrage `entity_miss` / PRE_EMIT après stream : un filet **remplace** une reply déjà produite. Ce n’est plus de la compréhension.

---

## 3. Actes dans `requestFrame.task.kind`

**Vérifié** — `detectTaskKind` n’écrit que :

| Valeur | Guard |
|--------|--------|
| `translate` | `isTranslationRequest` |
| `learn` | parcours technique ou apprentissage avec cible |
| `career_path` | `isCareerLearningPathRequest` |
| `explain` | overview technique **ou** information-seeking avec cible |
| `null` | tout le reste, y compris `socialOnly` |

Le typedef JSDoc promet aussi `debug` | `compare` | `procedure` | `build`. **Aucun n’est retourné.**

D’autres actes existent dans `QUERY_DOMAINS` / SC / `INTENT_FAMILIES_V1`, **pas** dans `task.kind` : debug, compare_choose, how-to, create/scoping, documents, math, datetime. Ils ne survivent que si le guard de famille match. Sinon le cycle dit `unknown`.

---

## 4. Pertes d’information (mécanisme)

| Élément humain | Où ça devrait vivre | État |
|----------------|---------------------|------|
| Acte (conseiller, configurer, créer…) | `requestFrame.task.kind` | Perdu hors 4 valeurs |
| Objet nommé | `domain.target`, `entities.subjects` | Vide si intents vides |
| Contexte fourni (« j’ai déjà X ») | `intent_assessment.constraints` | `currentProduct` = GPU seulement |
| Objectif (acheter, remplacer, faire) | slots de famille | Perdu hors guard |
| Livrable attendu | `response_commitment.kind` | Default evidence → `evidence_backed_factual` |
| Contraintes absentes (budget, usage) | slots compare_choose | Invisibles tant que la famille n’a pas matché |

**Vérifié à part** : `queryEntityUnderstanding` connaît déjà certaines marques (`TECH_BRAND_PATTERN`) et les classe en `general`. Ce signal **n’alimente pas** le cycle. Double extraction, pas une vérité unique.

---

## 5. Collisions d’autorité

| Couche | Vocabulaire | Autorité réelle aujourd’hui |
|--------|-------------|-----------------------------|
| `QUERY_DOMAINS` | math, webapp, compare_choose, unknown… | Cycle — **devrait** gagner |
| `requestFrame.task.kind` | 4 actes + null | Structure, souvent `null` |
| JUST | `general/explain`, `code/review`… | Shadow. Étiquette du vide |
| C4 `responseType` | direct / clarify / overview / scoping | Job de **reply**, pas acte |
| `conversationMove` | answer_direct / clarify_one / tool / refuse | Ambiguïté, pas acte |
| IntentStage | `expert_task` / `normal_conversation` | **Décide** le contrat si pipeline plein |
| Contrats | `CODE_INTENT`, `GUIDED_PRODUCT_…` | Aval ; fallback de classe |

Collision type :

1. Cycle : `unknown` + `full_pipeline` + evidence web (fraîcheur lexicale).
2. JUST : `general/explain` (défaut `GENERAL → EXPLAIN`).
3. IntentStage : longueur + `?` → `expert_task`.
4. Registre : `orchestrator:expert_task` → souvent `CODE_INTENT` (`skipWebSearch: true`).
5. COMPOSER + ancrage : hors sujet ou rejet.

JUST n’a **pas** créé le mauvais rail. Il a **nommé** le vide pendant qu’un autre classificateur **consommait** `expert_task`.

C4.2 ne gouverne que les rails **typés** (`*scoping*` / `*_clarify` / `*overview*`). `epistemic_verify_external`, `COMPOSER`, `named_create_start` échappent ([PRE_EMIT](../cartographie/pre-emit-coherence.md)).

---

## 6. Compréhension ≠ classification ≠ routage ≠ rendu

| Couche | Question | Objet | Choisit le path ? |
|--------|----------|-------|-------------------|
| Compréhension | Quel acte, sur quoi, avec quel contexte ? | Frame + `understanding` | Non |
| Classification | Quelle case catalogue ? | JUST, G46, IntentStage | Observer |
| Routage | Quelle forme est **compatible** ? | SC, `resolveIntentContract` | Oui, **après** le frame |
| Rendu | Comment formuler ? | `renderMode`, COMPOSER | Non (bouche) |

Aujourd’hui le SC **est** souvent la décision (pattern = reply). IntentStage **reclassifie** après le cycle. Le COMPOSER peut streamer avant le filet.

---

## 7. Ce que le cycle porte déjà

| Besoin | Déjà là | Limite |
|--------|---------|--------|
| Porte unique | `runAgentUnderstandingPhase` | Contournée en aval |
| Frame request | `analyzeRequestIntentFrame` | Actes trop pauvres |
| Frame conversation | social / task / composite | `task.present` = verbes créer/expliquer/comparer, pas conseiller/acheter |
| Domaines segment | `QUERY_DOMAINS` + `SEGMENT_DETECTORS` | Silence → `unknown` |
| Compare / reco | `compare_choose` + `GUIDED_PRODUCT_RECOMMENDATION` | Guard lexical, pas l’acte |
| Slots familles | `INTENT_FAMILIES_V1` | Spécialisation, pas condition d’existence de l’acte |
| Job de reply | `responseType` C4.1 | Orthogonal à l’acte |
| Canal | `renderMode` | Lots 1–5 |
| Entités | liste fermée | Ne pas élargir |
| Merge SC | `short_circuit_authoritative: false` | Le path émet quand même |
| Traduction | `frame.translation` riche | Preuve que le frame **peut** porter un acte |

Phrase canonique déjà dans le code (`COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY`). La famille **existe**. Une paraphrase d’acte voisin **tombe dans `unknown`**.

---

## 8. Ce qui manque au frame (sans 2e NLU)

Pas un JSON métier (`consumer_electronics`, scores 0.92). Mapping sur l’existant :

| Axe | Équivalent | Manque |
|-----|------------|--------|
| `userAct` | `task.kind` | `advise` / `compare` / `diagnose` / `procedure` / `create` / `plan` (typedef en partie déjà là) |
| Sujet | `domain.target` | Reste vide si pas de task |
| Contexte « j’ai X » | `constraints.currentProduct` | Trop étroit ; **pas** un champ `entities` |
| Trous | slots familles | Invisibles hors famille → pas d’ambiguïté **utile** |
| Livrable | `response_commitment.kind` | Calculé trop tard, depuis le domaine pas depuis l’acte |
| Confiance | ordinal high/medium/low global | Pas de score unique (canon). Flags discrets par axe possibles |

Ordre cible :

```
frame (acte, sujet, contexte, trous)
  → response_commitment (job, canal, kind, contrat licencié)
  → rail / contrat (forme compatible)
  → rendu (bouche)
```

Dérivation : **tables déterministes** dans `resolveResponseCommitment` / `resolveResponseType`. Interdit : nouvel extracteur, 5e packet, consume JUST, LLM amont.

Incomplétude :

- Slot **requis** absent → `responseType = clarify` (même job).
- Slot **utile** absent → `direct` + trou listé, **pas** `unknown`.
- Aucun acte (bruit) → `unknown` + `CONVERSATION_STANDARD`, jamais un contrat métier par classe.

---

## 9. Aval consommateur

| Couche | Rôle actuel | Rôle cible |
|--------|-------------|------------|
| JUST | Shadow + étiquette du vide | Shadow uniquement |
| IntentStage | 2e taxonomie → contrat | Budget / télémétrie |
| Fallback `orchestrator:${userIntent}` | `CODE_INTENT` sans guard | Guard only ; sinon `CONVERSATION_STANDARD` |
| SC emit | Pattern = décision si non typé | N’émet que si compatible acte + `responseType` |
| Épistémique | Change souvent la suite du tour | Retrieval / fraîcheur, pas un changement d’acte |
| Sovereign | Reclassifie encore | Exécute le contrat **déjà** posé |
| COMPOSER | Stream avant filet | Rend le commitment |
| Ancrage | Reconstruit un SN | Copie `subject` du frame |

Test d’autorité : si le frame dit `advise` et `isCodeIntentRequest === false`, aucun chemin ne peut écrire `CODE_INTENT`.  
`matchedBy: "orchestrator:expert_task"` = **échec de cadrage**, pas un routage légitime.

---

## 10. Faits, hypothèses, à valider

**Vérifié**

- `detectTaskKind` : 4 actes + `null` ; typedef partiellement mort.
- Silence G29 → `unknown` + `full_pipeline`.
- Fallback `orchestrator:expert_task` → `CODE_INTENT` sans guard code (probe 2026-09-09).
- C4.2 : seuls scoping / clarify / overview typés.
- JUST `GENERAL→EXPLAIN` = défaut d’un vide.
- Working tree plus avancé que HEAD / PLAN.

**Hypothèses**

- `conversationIntentFrame.task.present` est faux sur *conseils / donnerais / achat*.
- `unknown` + `?` + longueur → `expert_task` → `CODE_INTENT` est **fréquent**, pas un cas.
- Answer-then-ask est le bon défaut pour slots utiles de `advise` (entre en tension avec G31 clarify-first budget/usage).

**À valider avant tout runtime** — voir [plan de suite](plan-authoritative-input-understanding.md) § Validations préalables.

---

## 11. Hors diagnostic

Pas de GO. Pas de lot. Décision visée : [D-20260909](decisions/D-20260909-input-understanding-authority.md). Séquence de travail : [plan](plan-authoritative-input-understanding.md).
