# Matrice de décision de routage v1

**Lot** : `MATRIX-ROUTING-DECISION-V1`  
**Revue** : `REVIEW-MATRIX-ROUTING-DECISION-V1` (2026-09-16)  
**Siège cible** : `DECIDE-TARGET-SEAT-AND-CONTRACT` (2026-09-16) — Option **C provisoire, réversible**.  
**Revue M7** : `REVIEW-LOT3-SHADOW-CONTEXT` (2026-09-17) — états diagnostiques, résultat exploitable.  
**Revue Lot 3** : `REVIEW-LOT3-RESULT-USABILITY` (2026-09-17) — shadow validé, **non consommé**.  
**Lot persist** : `PERSIST-ROUTING-METADATA-V1` **ouvert** — allowlist vers `metadata_json`, reconstruction historique. Cache `lastRoutingResult` non autoritaire. Consume toujours interdit.  
**Statut politique globale** : hypothèse de travail, **non consommée** par le routeur.  
**Décisions produit** : M3, M7, M8, T9 **figées** dans cet artefact. Priorité = hypothèse ajustée, pas un routeur.  
**Nature** : spécification de décision. Pas un 2e NLU. Pas un packet JSON métier. Pas un ADR.

Source testable : [`server/tests/fixtures/routing-decision-matrix-v1.js`](../../server/tests/fixtures/routing-decision-matrix-v1.js)  
Preuve : [`server/tests/routing-decision-matrix-v1.spec.test.js`](../../server/tests/routing-decision-matrix-v1.spec.test.js)  
Observabilité Lot 1 : `routing_observe` (shadow uniquement).

Canon : [`citadelle-input-invariants.md`](citadelle-input-invariants.md) — pointer, ne pas recopier.  
Décision d’autorité : `D-20260909-frame-acte-autorite` dans [`decision-trace.md`](decision-trace.md).  
`task.kind` reste l’acte canonique. JUST reste shadow. `entities` inchangées. **Aucune cible dans `entities`.** Aucun champ runtime ajouté à `task` dans ce lot.

---

## Décisions produit enregistrées

| ID | Requête | Décision | Interdit |
|---|---|---|---|
| M3 | « tu peux m’aider ? » | assistant-directed sociale ; réponse déterministe de disponibilité | aucune action sans tâche concrète |
| M7 | « et maintenant ? » | continuation **seulement** si un contexte actif fournit une tâche ou une cible compatible ; sinon clarification courte | inventer une cible |
| M8 | « crée un fichier » | action **seulement** si nom, contenu et contexte sont suffisamment déterminés ; sinon clarification | contourner les contrôles et confirmations existants |
| T9 | « le dépôt est disponible ? » | cible dépôt / ressource externe ; question d’**état** | social assistant ; résumé / analyse automatique |

Pronom 2e personne : **n’élit pas le rail**.

| Requête | Rail |
|---|---|
| « tu peux m’aider ? » | **pas** une action (M3) |
| « tu peux lancer les tests ? » | action workspace (`ACTION_ADDRESSED`) |
| « tu peux analyser ce dépôt ? » | analyse dépôt (`REPO_ADDRESSED`) |

T2 reste un **écart runtime ouvert**. Pas d’implémentation `assistant_availability`. Pas de patch Pack 6 / Pack 8 / `socialPatternPolicy` / `isSimpleFactualQuestion`.

---

## Modèle acte / cible

Quatre lectures **déjà produites** par la chaîne, plus des **labels de matrice** (pas extraits au runtime) :

| Lecture | Source actuelle | Rôle |
|---|---|---|
| Forme / acte | `task.kind` (souvent `null`), JUST, shells | hypothèse d’acte |
| Cible | **non extraite** (`domain_target` null sur la matrice Lot 1) | label attendu seulement |
| Locator | guards existants (GitHub, URL, `extractSummaryUrl`) | contrainte d’exclusion |
| Ambiguïté | absente du runtime | clarify vs déterministe |

La cible **n’est pas** un champ `entities`. Elle n’est pas un second packet. Elle n’est pas un champ runtime `task.*`. Siège adopté : § [Siège de la cible — Option C](#siège-de-la-cible--option-c).

---

## Priorité (hypothèse de travail, non implémentée)

```text
sécurité et contraintes d’action
> continuation contextualisée
> action explicite suffisamment spécifiée
> assistant-directed déterministe
> locator spécialisé avec acte compatible
> factual externe
> explain
> clarification/fallback selon préconditions
```

Rangs : 1 sécurité → 2 continuation → 3 action spécifiée → 4 assistant-directed → 5 locator+acte compatible → 6 factual → 7 explain → 8 clarify documentaire.

**Clarify n’est pas seulement la dernière case.** C’est une **condition de prérequis** : si acte, cible, locator compatible ou contexte actif manquent, clarify **interrompt** la route à n’importe quel rang (M7 rang 2, M8 rang 3).

---

## Exclusions

- serveur/dépôt « disponible » ≠ social assistant
- dépôt disponible sans analyse/résumé ≠ `REPO_ANALYSIS`
- résumé de page sans GitHub ≠ `REPO_ANALYSIS`
- research-then-summarize conservé
- `tu` seul ≠ social
- `dispo` seul ≠ cible
- URL seule ≠ acte
- `est-ce que` seul ≠ factual
- miss social ≠ preuve de factualité
- « tu peux m’aider ? » ≠ action
- question d’état d’un dépôt ≠ analyse et ≠ action

---

## Ambiguïté

Déterministe : 2e personne + pas de ressource/locator + check d’état/aide (M1, T2, T1, M3, LA).  
Clarifier : cible inconnue (M9) ; continuation sans contexte actif (M7) ; create trop générique (M8).  
Ne pas « inventer » un rail déterministe pour masquer H.

---

## Contexte M7 — trois états diagnostiques

Pas un nouveau frame métier. Labels de politique hors frame (Option C).

```text
NO_CONTEXT
ACTIVE_CONTEXT
CONTEXT_AMBIGUOUS
```

Un **historique seul ne suffit pas**. Signal absent → `unknown`, pas d’inférence.

`ACTIVE_CONTEXT` **seulement** si les cinq critères sont `true` :

1. dernier acte exploitable ;
2. cible ou locator non ambigu ;
3. tâche ouverte **ou** résultat **exploitable** (pas « dernier message assistant non vide ») ;
4. compatibilité avec la continuation ;
5. aucune demande incompatible plus récente.

Conjunction : un `false` → `NO_CONTEXT` ; aucun `false` et au moins un `unknown` → `CONTEXT_AMBIGUOUS` ; cinq `true` → `ACTIVE_CONTEXT`.

`NO_CONTEXT` couvre : requête isolée ; absence d’acte précédent exploitable ; simple check-in ; historique sans tâche ouverte ; demande plus récente incompatible (le fil précédent n’est plus continuable).

`CONTEXT_AMBIGUOUS` couvre : cible inconnue ; plusieurs tâches candidates ; compatibilité inconnue ; statut du contexte impossible à établir.

Clarification courte si `NO_CONTEXT` ou `CONTEXT_AMBIGUOUS`. Pas d’invention de cible.

### Résultat exploitable

**Interdit** : traiter « dernier message assistant non vide » comme définition suffisante.

Un résultat est exploitable seulement s’il est :

- produit par un pipeline identifiable ;
- associé à un acte ou une tâche ;
- non interrompu ;
- non purement social ;
- non purement méta ;
- compatible avec la demande de continuation.

**Positifs** : résumé de dépôt ; analyse de fichier ; résultat de tests ; création ou modification confirmée ; résultat d’une tâche explicitement identifiée.

**Négatifs** : salutation ; réponse de disponibilité ; clarification seule ; erreur générique ; sortie de diagnostic interne ; réponse interrompue ; pipeline non identifiable.

Observabilité Lot 3 (`ALIGN-LOT3-RESULT-USABILITY`) : `result_usability_criteria_shadow` (six critères tri-état) et `result_usability_shadow` (`exploitable` / `non_exploitable` / `unknown`). Champ absent → `unknown`, jamais converti. M7 `open_task_or_recent_result` = tâche ouverte **ou** `exploitable` ; `unknown` ne produit pas `ACTIVE_CONTEXT`. Non consommé.

### Politique temporelle

Pas de fenêtre en minutes.

Ordre de lecture, s’ils existent déjà :

1. statut de tâche ;
2. identifiant de tour ou ordre conversationnel ;
3. compatibilité sémantique ;
4. absence de tâche plus récente incompatible.

Statut ou ordre absent → `unknown`, pas d’horloge inventée.

### Exemples d’états

| T-1 | T0 | État |
|---|---|---|
| résumé dépôt GitHub livré par `repo_analysis_llm` | « continue » | `ACTIVE_CONTEXT` |
| `notes.md` créé (pipeline create, confirmé) | « ajoute une section changelog » | `ACTIVE_CONTEXT` |
| tests lancés, résultat de pipeline | « relance-les » | `ACTIVE_CONTEXT` |
| (aucun) | « et maintenant ? » | `NO_CONTEXT` |
| check-in « comment ça va ? » | « et maintenant ? » | `NO_CONTEXT` |
| historique long, aucune tâche ouverte | « continue » | `NO_CONTEXT` |
| résumé d’un dépôt | « le serveur est dispo ? » | `NO_CONTEXT` (incompatible plus récente) |
| deux dépôts, locator non unique | « fais pareil » | `CONTEXT_AMBIGUOUS` |
| résumé dépôt, compatibilité de T0 inconnue | « et maintenant ? » | `CONTEXT_AMBIGUOUS` |

---

## Coût

| Famille | Coût max | Ollama |
|---|---|---|
| A assistant-directed court | `low` | **interdit** sans justification |
| B ressource externe | `medium` | seulement si outil/fait l’exige |
| C factual monde | `low` si déterministe | pas 24 s par défaut |
| D/E locator spécialisé | `high` | acceptable |
| F workspace | `medium` | selon l’action ; **interdit** si M8 underspecified |
| G continuation | `low` / `clarify` | interdit si elliptique sans contexte |
| H ambigu | `clarify` | interdit |

Toute divergence candidate `low` vs route `very_high` doit rester observable (`routing_observe`).

---

## Matrice

| Cas | Acte | Cible | Locator | Route candidate | Priorité | Exclusions | Décision attendue | Clarification | Coût |
|---|---|---|---|---|---:|---|---|---|---|
| M1 | availability assistant | assistant | — | social_deterministic | 4 | factual, Ollama, miss≠factual | social_deterministic | non | low |
| T2 | availability assistant | assistant | — | social_deterministic | 4 | factual via est-ce que, Ollama | social_deterministic | non | low |
| T1 | wellbeing | assistant | — | social_deterministic | 4 | factual | social_deterministic | non | low |
| M2 | dispo ressource | server | — | factual_or_tool | 6 | social | factual_or_tool | non | medium |
| M3 | offre d’aide | assistant | — | social_deterministic | 4 | factual, action | social_deterministic (dispo, pas d’action) | non | low |
| M4 | fait monde | world | — | simple_factual | 6 | social | simple_factual | non | low |
| M5 | résumé dépôt | repository | github root | repo_analysis_llm | 5 | WEB_SUMMARY | repo_analysis_llm | non | high |
| M6 | résumé page | page | web URL | document_synthesis_llm | 5 | REPO_ANALYSIS | document_synthesis_llm | non | high |
| M7 | continuation | context | — | continuation si contexte actif, sinon clarify | 2 | factual, Ollama, cible inventée | **clarify** sans contexte actif | oui si pas de contexte | clarify |
| M8 | create | workspace | — | named_create si spécifié, sinon clarify | 3 | social | **clarify** (nom/contenu/contexte manquent) | oui | clarify |
| M9 | indéterminé | unknown | — | clarify | 8 | social, factual, Ollama | clarify | oui | clarify |
| T9 | état dépôt | repository | github root | factual_or_tool | 5 | social, REPO_ANALYSIS | factual_or_tool (état, pas analyse) | non | medium |
| T10 | résumé dépôt | repository | github root | repo_analysis_llm | 5 | WEB_SUMMARY, social | repo_analysis_llm | non | high |
| RTS | research-then-summarize | named repo topic | — | information_seeking | 6 | REPO, WEB_SUMMARY isolé | information_seeking | non | high |
| TU_DATETIME | date historique | world | — | simple_factual | 6 | social (tu insuffisant) | simple_factual | non | low |
| ESTCE_FACTUAL | fait monde | world | — | simple_factual | 6 | est-ce que ≠ preuve | simple_factual | non | low |
| ACTION_EXPLICIT | lance tests | workspace | — | action_pipeline | 3 | social | action_pipeline | non | medium |
| ACTION_ADDRESSED | tu peux lancer les tests | workspace | — | action_pipeline | 3 | social | action_pipeline | non | medium |
| REPO_ADDRESSED | tu peux analyser ce dépôt | repository | github root | repo_analysis_llm | 5 | social | repo_analysis_llm | non | high |
| LA | présence assistant | assistant | — | social_deterministic | 4 | factual, Ollama | social_deterministic | non | low |

Conservés (gap=false) : T1, M5, M6, T10, RTS, TU_DATETIME, ESTCE_FACTUAL, REPO_ADDRESSED.  
Écarts ouverts (gap=true) : T2, M1, M3, M4, M7, M8, M9, T9, ACTION_EXPLICIT, ACTION_ADDRESSED, LA.

---

## Contradictions (politique vs runtime)

| Cas | Signaux | Route actuelle | Shadow Lot 1 | Attendue | Écart | Correction proposée | Faux positif | Repli |
|---|---|---|---|---|---|---|---|---|
| T2 | 2e pers., pas de locator, court, est-ce que | simple_factual_lookup + Ollama | social_deterministic | social_deterministic | miss social ⇒ factual | politique A + exclusion est-ce que/miss≠factual ; **implémentation amont hors de ce lot** | ne pas socialiser tout est-ce que | jamais Ollama sur A |
| M1 | 2e pers., pas de ressource | fallthrough | social | social | pas de garde | même famille A que T2 | — | social court |
| M3 | offre d’aide, 2e pers. | fallthrough | social | social_deterministic | pas de garde | **décidé** : dispo déterministe, pas d’action | ne pas lancer un outil | social court |
| M4 | fait monde, inversion est-elle | fallthrough | none | simple_factual | factual trop étroit | famille C sans exiger est-ce que | ne pas factualiser tout ? | déterministe local si possible |
| M7 | elliptique | fallthrough | none | clarify sans contexte | pas de famille G | **décidé** : continuation seulement si contexte actif | ne pas continuer hors fil | clarify courte |
| M8 | create générique | fallthrough / action | none | clarify | préconditions manquent | **décidé** : nom+contenu+contexte, sinon clarify | ne pas créer un fichier anonyme | contrôles existants si action |
| M9 | dispo sans cible | fallthrough | none | clarify | H ignoré | priorité/prérequis clarify | ne pas social ni factual | clarify |
| T9 | dépôt + URL + disponible, pas d’analyse | fallthrough | none | factual/tool état | pas B | **décidé** : état ≠ analyse ≠ action ≠ social | ne pas REPO | tool/fait, pas social |
| TU_DATETIME | tu + date | simple_factual (OK) | social (bruit) | simple_factual | shadow trop large | exclusion tu insuffisant | ne pas promouvoir ce shadow | garder factual |

---

## Siège de la cible — Option C

**Décision** `DECIDE-TARGET-SEAT-AND-CONTRACT` : Option **C** adoptée **provisoirement**, **réversible**.

- la cible reste **hors** du frame canonique ;
- aucune cible dans `entities` ;
- aucun nouveau champ `task` ;
- aucune seconde structure NLU ;
- la politique peut **lire** des projections dérivées de guards existants ;
- ces projections restent **non autoritaires** tant qu’un lot futur ne les consomme pas explicitement.

| Option | Id | Statut |
|---|---|---|
| C | `outside_frame_selection_policy` | **adoptée provisoire** — politique hors frame |
| A | `derived_nondecisional_projection` | **labels seulement** — diagnostic / politique, jamais source de vérité |
| B | `future_controlled_task_extension` | **rejetée pour l’instant** — pas de champ `task` |

B reste possible plus tard par GO + ADR, si l’acte seul ne peut plus porter T9 / M3. Ce n’est pas le siège actuel.

### Garde-fous des projections (idées A, non autoritaires)

Interdit : `targetDetector` indépendant. Interdit : inférer une cible manquante.

Les projections ne peuvent lire que :

- signaux déjà présents ;
- guards existants ;
- locators déjà reconnus ;
- contexte déjà disponible ;
- résultats de la chaîne amont existante.

Si un signal est absent → label `unknown`. Pas d’invention. `unknown` n’est pas une preuve de factualité ni de social.

Les labels A n’écrivent ni `task.kind`, ni `entities`, ni un packet parallèle. Un aval qui les lirait comme autorité **casse** C.

### Règle T2 (Lot 3 shadow — observée, non consommée)

Conserver `route_compatibility_shadow=suspect` sur T2. **Ne pas consommer.** Ne pas promouvoir `candidate_route_shadow`. Ne pas utiliser `second_person` seul. Pas d’`assistant_availability`. Pas de patch `socialPatternPolicy` / `isSimpleFactualQuestion` / routeur.

```text
requête courte
+ deuxième personne
+ aucun objet externe
+ route factuelle coûteuse
+ interprétation assistant-directed plausible
→ route factuelle marquée suspecte (shadow)
```

Exclusions conservées : T9, M2, M4 (hors lot), TU_DATETIME. La règle T2 ne se généralise pas au pronom `tu`. L’exclusion TU_DATETIME via `secondary_action_verb` est **incomplète** ; sujet séparé, pas une correction ici.

### Lot 3 shadow (ouvert, non consommé)

**Fait** : observer la règle T2 ; labels A non autoritaires ; états M7 `NO_CONTEXT` / `ACTIVE_CONTEXT` / `CONTEXT_AMBIGUOUS` (spec) ; routes runtime inchangées.

**Hors** : consommer la matrice dans le SC ; créer un extracteur ; écrire `task` / `entities` ; patch `social/availability_check` ; élargir `isSimpleFactualQuestion` ; corriger M4 « est-elle » ; promouvoir `second_person` ; Pack 6 ; Pack 8 ; TLS ; GitHub ; `task.kind`.

---

## Hors périmètre (consommation)

Pas de consommation runtime. Pas de `assistant_availability`. Pas de patch `dispo`. Pas de changement `isSimpleFactualQuestion`, Pack 6, Pack 8, `task.kind`, `requestFrame`. Le Lot 3 shadow **observe seulement**.
