# C4 — Décision du type de réponse

| Champ | Valeur |
|-------|--------|
| **Chantier** | `C4_RESPONSE_TYPE_DECISION_LAYER` |
| **Date** | 2026-09-06 |
| **Statut** | **Cadrage ouvert — pas de runtime** |
| **Canon** | [`citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md) |
| **Diagnostic** | [`agent-upstream-decision.md`](./agent-upstream-decision.md) §6.5 / U7 |
| **Lots 1–5 autorité** | Clos. Ne pas rouvrir. |

Pas un 2e NLU. Pas une 5e couche packet. Le cycle a déjà le paquet ; il n’y écrit pas encore **le job de la reply**.

Ne pas confondre avec le risque **C4** de [`agent-comprehension-conversation.md`](./agent-comprehension-conversation.md) §7 (épistémique seulement dans SC). Ici : **METHODE C4** — pattern → reply sans correspondance.

---

## 1. Type de réponse — définition opérationnelle

Dans Nexxus, **type de réponse** = le **job autorisé de la reply de ce tour**.

Ce n’est pas :

| Notion | Où ça vit déjà | Rôle |
|--------|----------------|------|
| Domaine / famille | `intent_assessment.primaryDomain`, `familyId` | **Quoi** (sujet) |
| Stratégie | `responseStrategy` (`partial_clarify`, `deterministic`, …) | Intensité / incomplet |
| Canal de rendu | `response_commitment.renderMode` | **Comment** livrer (`clarify` / `deterministic` / `contractual_llm` / `llm_direct`) |
| Forme de rail | `path` SC, `pipelinePath` | **Comment formuler** une fois le job choisi |
| `kind` | `response_commitment.kind` | Contrat de forme (slots, sections) — trop hétérogène pour C4 |

**Règle :** un pattern propose une **forme compatible**. Il ne choisit pas le job.

Séquence cible (déjà dans §6.5) :

1. Compréhension — `understandQuery` + workup
2. **Type de réponse** — job de la reply ← **trou**
3. Pattern / rail — forme compatible avec ce job
4. Exécution — déterministe ou LLM

Lots 1–5 : le cycle gagne sur `renderMode` (canal). C4 affine le **job** dans le même `response_commitment`. Pas un second décideur parallèle.

---

## 2. Taxonomie minimale

Taxonomie de départ évaluée : `direct_actionable` / `clarify` / `overview` / `scoping` / `social`.

**Proposition retenue : 4 valeurs.** `social` retiré du enum C4.

| Valeur | Job du tour | Exemple |
|--------|-------------|---------|
| `direct` | Livrer l’acte demandé (procédure, fait, salut, calcul) | « comment créer une base dans phpMyAdmin » |
| `clarify` | Une question pour **le même job** (slot manquant) | how-to sans objet |
| `overview` | Cartographier / inventorier, pas exécuter | « qu’est-ce que tu sais faire », aperçu pédagogique |
| `scoping` | Recadrer en **projet / livrable** avant d’agir | site vitrine, guided creation, forge projet |

### Pourquoi pas `social`

`QUERY_DOMAINS.SOCIAL` existe déjà. Un check-in complet est un `direct` phatique. Mettre `social` dans C4 mélange domaine et job, et invite chaque rail social à « décider le type ». Hors C4.

### Pourquoi garder `scoping` (pas le fondre dans `clarify`)

Les deux posent des questions. `clarify` complète le job actuel. `scoping` **change** le job (« concevons un site »). Cas live phpMyAdmin : le rail a posé une question de **scoping** alors que le job était **direct**. Si on fusionne, le trou redevient invisible.

### Alias

`direct_actionable` (départ) = `direct` (court, aligné `sections: ["direct_answer"]`).

---

## 3. Signaux d’entrée (cycle existant seulement)

Interdit : nouvel extracteur, JUST consume, champ `entities` nouveau.

| Signal | Usage C4 |
|--------|----------|
| `intent_assessment.responseStrategy` | `PARTIAL_CLARIFY` vs livrable complet |
| `intent_assessment.familyId` / `primaryDomain` | Distinguer scoping (`webapp` / guided / forge) vs clarify générique vs overview |
| `understanding.intents[].path` | Forme **proposée**, pas le job |
| `intent_assessment.constraints` / slots manquants | `clarify` si le job est déjà le bon et qu’il manque un slot |
| `renderMode` | Canal déjà décidé (lots 1–4). C4 ne le remplace pas. |

Dérivation **lot 1** (lecture seule des blocs, pas de 2e NLU) :

| Condition (ordre) | `responseType` |
|-------------------|----------------|
| `PARTIAL_CLARIFY` et famille / domaine projet (`web_project_scoping`, `webapp`, guided creation, forge projet) | `scoping` |
| `PARTIAL_CLARIFY` sinon | `clarify` |
| Famille overview / pédagogie large / capability inventory | `overview` |
| Sinon | `direct` |

Cette table **expose** le job. Elle ne corrige pas encore un faux `PARTIAL_CLARIFY` (le cycle peut encore entériner le mauvais pattern — §6.5). La correction de correspondance = lot **ultérieur**, pas lot 1.

---

## 4. Rails qui sautent l’étape 2

Pattern détecté → `path` / `emit` / `pipelinePath` = reply. Pas de job explicite.

| Rail / détecteur | Saut | Job réel souvent | Job imposé par le pattern |
|------------------|------|------------------|---------------------------|
| `classifyWebProjectScopingRequest` → `web_project_scoping_*` | Oui (cas live) | `direct` (outil nommé) ou `scoping` (vitrine) | `scoping` / `clarify` |
| `guided_creation_scoping` | Oui | `direct` ou `scoping` | `scoping` |
| `forge_project_scoping_*` | Oui | idem | `scoping` |
| `launcher_guide_clarify` / `_deterministic` | Oui | `direct` ou `clarify` | clarifier launcher |
| `how_to_clarify` vs `how_to_simple_local` | Partiel | `direct` ou `clarify` | path = décision |
| `conversationMovePolicy` family → `pipelinePath` | Oui | selon le move | family gagne |
| `socialPatternPolicy` → `social_deterministic` | Oui | `direct` phatique | forme sociale |
| `INSTANT_RESPONSES` | Oui | `direct` | table exacte |
| architecture / capability overview | Partiel | `overview` | souvent explain / COMPOSER |

Les lots 1–4 empêchent un `*_clarify` si `renderMode !== "clarify"`. Ça ne dit pas si le clarify est **scoping** ou **slot du how-to**. C4 commence là.

---

## 5. Paquet compatible — pas de nouvelle couche

Invariant 4 : packet → copie → arrêt.

**Champ :** `response_commitment.responseType`

| Candidat | Verdict |
|----------|---------|
| Nouveau packet / étape pipeline | Non. 2e NLU déguisé. |
| `renderMode` | Non. Canal (lots 1–4). `clarify` ≠ job `scoping`. |
| `kind` | Non. Déjà fourre-tout (`guided_product_comparison`, domaine, `deterministic`). |
| `responseStrategy` | Non. Stratégie d’incomplétude, pas job. |
| **`response_commitment.responseType`** | **Oui.** Même objet, enum fermé, télémétrie `requestWorkup` déjà flushée. |

SC continue d’annoter sous `short_circuit` (lot 4). Il n’écrit pas `responseType` au lot 1.

---

## 6. Lot 1 C4 proposé (étroit, testable)

| Champ | Valeur |
|-------|--------|
| **Id** | `C4_RESPONSE_TYPE_ON_COMMITMENT_V1` |
| **Objectif** | Rendre le job visible sur le workup. Zéro gate SC / move / façade. |
| **Périmètre** | `resolveResponseCommitment` dans `conversationQueryUnderstanding.js` + un test. Rien d’autre. |
| **Preuve** | Test : how-to outil nommé (phpMyAdmin) → `responseType === "direct"` **si** le cycle ne pose pas déjà `PARTIAL_CLARIFY` webapp ; vitrine explicite → `scoping` ; how-to sans objet → `clarify`. Documenter l’écart si le cycle entérine encore le faux pattern (hors lot 1). |
| **Invariants** | 1 (pas de 2e NLU), 4 (pas de packet neuf), 6 (JUST shadow), lots 1–5 intacts, pas de perso / ton. |
| **Risques** | Mapper `PARTIAL_CLARIFY`+webapp → `scoping` **reproduit** le faux positif phpMyAdmin **en le rendant visible**. C’est voulu au lot 1. Corriger la correspondance = lot 2 C4, pas celui-ci. |

**Hors lot 1 :** `emit` SC, `IntentStage`, façade, JUST, `entities`, refonte détecteurs, C3 COMPOSER.

**Lot 2 C4 (pas ouvert) :** un rail `*_scoping` / `*_clarify` ne `emit` que si `responseType` du cycle est compatible (`scoping` / `clarify`). Pattern propose ; cycle job tranche. Un seul rail témoin (`web_project_scoping_*`), pas tout le SC.

---

## 7. Ouverture

Cadrage = ce fichier. Runtime = seulement après GO explicite sur `C4_RESPONSE_TYPE_ON_COMMITMENT_V1`.
