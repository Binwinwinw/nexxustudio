# SPEC-CONSUME-CONTRACT-V1 — contrat de promotion shadow

**Lot** : `SPEC-CONSUME-CONTRACT-V1`  
**Statut** : spécification **enregistrée, non consommée**. Aucun GO d’implémentation runtime.  
**Dépend de** : `AUDIT-ROUTING-AUTHORITY-CONFLICTS` (conflit confirmé), Lot 3 shadow, persist métadonnées.  
**Interdit jusqu’à GO consume dédié** : promotion runtime, correction T2, Pack 6/8, `assistant_availability`, M4, TU_DATETIME.

Source testable : [`server/tests/fixtures/consume-contract-v1.js`](../../server/tests/fixtures/consume-contract-v1.js)  
Preuve : [`server/tests/consume-contract-v1.spec.test.js`](../../server/tests/consume-contract-v1.spec.test.js)

Canon : [`citadelle-input-invariants.md`](citadelle-input-invariants.md) — JUST shadow, pas de 2e NLU. Pointer, ne pas recopier.  
Matrice produit : [`routing-decision-matrix-v1.md`](routing-decision-matrix-v1.md) — M3/M7/M8/T9, Option C, T2 disponibilité `suspect`.  
Conflit d’autorité : événement `routing_authority_conflict`, `runtimeAligned` preuve SC.

Nature : contrat de **sécurité du consume**. Pas un routeur. Pas un packet NLU.

---

## Décision

Une promotion shadow n’est **pas** le défaut. Le défaut est `blocked` + `shadow_consumed=false`.

Le flag `SHADOW_PROMOTION_CONSUME` est **désactivé**. Un futur consume ne s’allume que par GO + flag explicite.

T2 conversationnel **n’est pas** le premier cas de promotion. Il exige d’abord une décision distincte sur `social_checkin` / `casual_status` / `workPresent`.

---

## Point unique

Un futur consume, s’il existe, sera :

| Règle | Valeur |
|---|---|
| Fonction | `evaluateShadowPromotion` **une seule** |
| Siège | avant le choix final de pipeline (après SC, avant word-guard / composer) |
| Flag | `SHADOW_PROMOTION_CONSUME`, défaut `false` |
| Événement | `shadow_promotion_decision` **avant** exécution |
| Sortie | `promoted` \| `blocked` \| `unknown` |
| `shadow_consumed` | `false` tant que le runtime n’est pas branché |

Indépendant de `pipelineTelemetryCtx.deliverableContract`, des logs `onStep`, de toute relecture d’un champ observe.

**Sièges interdits** : `simple_fast`, `deliverableContractPolicy`, `socialPatternPolicy`, `turnComprehension`, `enforceModeContract`.

`promoted` dans ce contrat = **éligible sous preuve**. Ça n’exécute rien tant que `runtimeWired=false`.

---

## Conditions positives (conjonction)

Toutes vraies. Une absente ou `unknown` → pas de promotion.

1. Candidate produite par la chaîne existante (SC, routing case, pattern SC, pas un contrat observe).
2. Raison explicite (`candidate_reason`).
3. Aucune autorité supérieure ne contredit.
4. Aucun `routing_authority_conflict`.
5. `shortCircuit` n’a pas déjà une décision incompatible (path égal à la candidate, ou absent seulement hors conflit — et dans ce lot `shortCircuit=null` refuse toujours).
6. Route déterministe ou coût borné dans le budget de famille.
7. Réponse attendue définie.
8. Fallback déterministe existant.
9. Décision journalisée **avant** exécution.
10. Feature flag explicite **activé**.
11. Le défaut du flag reste désactivé (`defaultEnabled=false`).

---

## Conditions négatives (une suffit)

Refuser si :

- `shortCircuit=null` (avec ou sans conflit) ;
- `routing_authority_conflict=true` ;
- `runtimeAligned=false` ;
- candidate venue **uniquement** d’un contrat observe ;
- candidate = token lexical isolé ;
- cible inconnue ;
- plusieurs candidats plausibles ;
- résultat attendu = LLM libre seulement ;
- aucun fallback déterministe ;
- coût prévu > budget de famille ;
- flag absent ou désactivé ;
- `cost_class` / `cost_observed` absents → `unknown`, **pas d’optimisme**.

---

## Conflit vs absence de route

```text
absence de short-circuit sans conflit
≠
absence de short-circuit avec conflit
```

| Situation | Promotion |
|---|---|
| `shortCircuit=null`, aucun conflit, candidate absente | pas de promotion (`blocked`, `no_candidate` / `sc_null_without_conflict`) |
| `shortCircuit=null`, conflit présent, candidate sociale | **blocage strict** |
| `shortCircuit=route`, `runtimeAligned=true` | éventuellement éligible si le reste du contrat tient |
| `shortCircuit=route`, `runtimeAligned=false` | blocage |

---

## Cas T2 conversationnel — bloqué

```text
candidate shadow = social_deterministic
shortCircuit = null
routing_authority_conflict = true
runtimeAligned = false
cost = high (anomalie)
→ promotion refusée
→ shadow_consumed=false
```

Ne pas « réparer » T2 par consume. D’abord trancher le conflit catalogue / décomposition / `workPresent`.

T2 disponibilité (« est-ce que tu es dispo maintenant ? ») = autre famille (Lot 3 `suspect`, `simple_factual_lookup`, `very_high`). Aussi `block`. Pas `assistant_availability`.

---

## Repli

Par famille, si promotion refusée — **sans** appeler Ollama « parce que le shadow est bloqué » :

| Famille | Repli sûr |
|---|---|
| social check-in / continuité | réponse déterministe low-cost **si** un rail existant la produit déjà ; sinon **conserver le comportement actuel** tant qu’aucune option sûre n’est prouvée |
| continuation (M7) | clarification courte si pas de contexte actif |
| action sous-spécifiée (M8) | clarification, pas LLM libre |
| route suspecte (T2 dispo) | ne pas émettre `INSUFFICIENT_SIGNAL_REFUSAL` **comme politique de consume** ; le runtime actuel n’est pas corrigé ici |
| inconnu | conservation du comportement actuel |

Interdit :

- promotion silencieuse ;
- LLM par défaut après un shadow bloqué ;
- réponse méta qui révèle contrats internes ;
- transformer un conflit d’autorité en demande d’objectif sans preuve.

---

## Coût

| Famille | Budget max `cost_class` | Ollama pour candidate déterministe |
|---|---|---|
| `social_checkin` / `social_continuity` | `low` | **interdit** |
| assistant-directed social (M3) | `low` | interdit |
| factual externe | `high` | hors promotion sociale |
| repo / web | `very_high` | hors promotion sociale |

Journal futur (événement `shadow_promotion_decision`) : `cost_before`, `cost_expected`, `cost_after`, `over_budget_reason`.  
Absence de coût observé → `unknown`, pas `low` par défaut.

T2 conversationnel actuel (`word_guard` → `simple_fast` ~7 s) = **anomalie de coût**. Ce lot ne la corrige pas.

---

## Matrice de sécurité

| Cas | Candidate | Preuve | Conflit | Runtime aligned | Coût | Promotion |
|---|---|---|---|---|---|---|
| T2 conversationnel | social | insuffisante | oui | false | high | **block** |
| T2 disponibilité | social / factual | insuffisante | autre famille | unknown | very_high | **block** |
| route déterministe valide | social_deterministic | complète | non | true | low | **eligible** (spec only, flag on) |
| observe seul | observe | absente | unknown | unknown | unknown | **block** |
| candidat lexical | variable | faible | variable | unknown | variable | **block** |
| cible inconnue | variable | absente | variable | unknown | unknown | **block** |

---

## Compatibilité

- JUST : shadow. Ce contrat ne consomme pas JUST.
- Option C : cible hors frame. Cible inconnue → pas de promotion.
- M3/M7/M8/T9 : inchangés.
- `shadow_consumed=false` jusqu’à GO consume **et** branchement runtime.
- Pack 8 fermé, sans GO.

---

## Hors lot

Pas de runtime. Pas de consume. Pas de patch `gateSocialFinalize` / `workPresent` / `word_guard` / `simple_fast`. Pas de commit requis par ce lot.
