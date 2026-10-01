# Plan de suite — authoritative input understanding

**Nature** : plan opératoire. Pas une ADR. Pas un diagnostic. Pas un GO.  
**Date** : 2026-09-09  
**Décision** : [D-20260909](decisions/D-20260909-input-understanding-authority.md) (cadrage long ; les 3 D-* de l’index sont `accepted`)  
**Diagnostic** : [`from-input-understanding-to-authoritative-routing.md`](from-input-understanding-to-authoritative-routing.md)  
**Index** : [`decision-trace.md`](decision-trace.md)

Aucun lot n’est ouvert. `dev/PLAN.md` ne reçoit une ligne **que** le jour d’un GO nommé.

---

## Intention du plan

Transformer le cadrage en **chemin sûr** : ordre, dépendances, validations avant runtime, critères d’arrêt, découpage **éventuel** en lots.

Faire F3 avant F1, ou un patch téléphone, = faux progrès.

---

## Étapes naturelles

```
0   Mémoire        index + D-* proposed          ← fait (GO doc)
V   Validations de cadrage (5 axes) — pas du runtime  ← fait (FAIL)
0b  Accepter       D-* → accepted                ← fait (GO texte 2026-09-10)
F1  Frame          task.kind tenu                ← **fait** — ebc1dd0 (2026-09-30) ; GO texte accepted le 2026-09-10 (create non câblé)
F2  Contrats       plus d’auteur de classe
F3  Emit           rails non typés respectent l’acte
F4  Incomplétude   slot utile ≠ vide d’acte
T   Familles       paraphrases (transverse, à chaque Fi)
```

---

## Ordre de dépendance

| Étape | Dépend de | Inutile trop tôt |
|-------|-----------|------------------|
| **0** | — | — |
| **V** | 0 | F1 / runtime « pour faire passer V » ; `accepted` sans constat |
| **0b** | V collé | GO texte sans constat des 5 axes |
| **F1** | 0b (`accepted`) | Regex « conseils » / rail reco produit ; F1 tant que `proposed` |
| **F2** | F1 au moins sur les actes visés **ou** V a montré le volume `orchestrator:expert_task` | Blocklist `CODE_INTENT` seul (DIAGNOSTIC prend le relais) |
| **F3** | F2 clos | Typer tout `intentShortCircuit.js` maintenant |
| **F4** | D-commitment / choix produit tranché | G31 clarify budget **avant** que l’acte `advise` existe |
| **T** | commence dès F1 | Un test par formulation live |

F2 sans F1 : plus de revue de code fantôme, encore un `explain` / factual générique.  
F1 sans F2 : le frame peut être juste, le contrat encore faux.  
F3 sans F1–F2 : C4.2 étendu sur un `responseType=direct` **vide d’acte**.  
F4 sans F1 : on clarifie des slots d’une famille qui n’a pas matché.

---

## V — validations de cadrage

Norme : [`decision-trace.md`](decision-trace.md) § V. Cette page ne duplique pas. Pointe.

Porte **hors runtime**. Objectif : paraphrases + télémétrie **avant** `accepted` et **avant** F1.

Règle courte : V non collé → D-* `proposed`. V collé + GO texte → `accepted`. F1 fermé tant que cette séquence n’est pas tenue. GO de lot F1 donné par l’utilisateur le 2026-09-30 (livré dans ebc1dd0) ; F2 à F4 restent sans GO de lot. FAIL = résultat. V n’est pas F1.

V collé 2026-09-09 : FAIL 5 axes, batterie advise / compare / currentItem / budget / usage + voisins. Voir la trace.

GO texte 2026-09-10 : D-* `accepted`. F1 **livré** (ebc1dd0) ; F2 à F4 non ouverts.

---

## Prérequis de test (quand un lot existera)

Pas un test lexical isolé. Pour chaque `task.kind` touché :

- paraphrases hors `mustInclude` de la famille ;
- sujet nommé → non vide dans le frame ;
- variante contexte fourni (« j’ai déjà X ») → slot / constraints, pas seulement la query brute ;
- variante trou **utile** → pas `unknown` ;
- variante trou **requis** → `clarify` ;
- contre-exemple voisin (même sujet, autre acte) ;
- assert : `task.kind` · `responseType` · contrat ∈ allowed · contrat ∉ forbidden · `matchedBy` ≠ `orchestrator:*` (sauf default).

Le **path** n’est pas la vérité. Un `guided_*` ou un pipeline + web peuvent tous deux être justes.

---

## Ce qu’il faut faire en premier

1. Relire [Interdits](decision-trace.md#interdits-actifs).
2. **V collé** (FAIL 5 axes) — fait.
3. GO **texte** → `accepted` — **fait** 2026-09-10.
4. **F1 fait** — ebc1dd0 (2026-09-30) ; GO texte accepted le 2026-09-10. F2 seulement si GO de lot.

---

## Ce qu’il ne sert à rien de faire trop tôt

- Guard `conseils` / `Nothing Phone` / `n8n`.
- Nouveau rail `purchase_advice`.
- Consume JUST.
- Champ `entities.currentItem`.
- Refactor du god-file SC.
- Typer tous les paths C4.2.
- Rouvrir C4.1 pour y mettre `recommend` dans `responseType`.
- Un JSON frame parallèle « pour voir ».

---

## Risques de faux progrès

| Symptôme | Pourquoi c’est faux |
|----------|---------------------|
| Le cas live passe, la paraphrase sœur casse | Patch lexical |
| Plus de `CODE_INTENT`, encore `DIAGNOSTIC` / `DOCUMENT_ANALYSIS` | F2 incomplet |
| `task.kind=advise` et `matchedBy=orchestrator:expert_task` | F2 non fait |
| Tests verts sur canonicalQueries G31 seulement | Pas une famille |
| `responseType=direct` sur `unknown` | C4.1 masque le vide d’acte |
| Ancrage réparé, contrat encore code | Perte tertiaire traitée, primaire intacte |

---

## Critères d’arrêt

S’arrêter (pas de code, pas d’étape suivante) si :

- la solution proposée figure dans les Interdits ;
- V n’est pas collé (5 axes) ;
- on passe `accepted` sans V ;
- F1 (ou autre lot) sans GO de lot nommé ;
- le lot n’a pas les 5 champs + `Décision: D-20260909` (ou successeur) ;
- un rouge gelé du canon est « réparé au passage » ;
- F3 ou F4 est tenté avant la dépendance ;
- deux normes `accepted` se contredisent sans supersession.

---

## Découpage futur en lots (sans GO)

Candidats. **F1 fait** (commité : ebc1dd0 ; create resté hors). F2–F4 non ouverts.

| Candidat | Objectif | Périmètre probable | Preuve | Hors périmètre |
|----------|----------|--------------------|--------|----------------|
| **F1** | `task.kind` écrit pour advise/compare/diagnose/procedure/create à partir des guards existants | `requestIntentFrame.js`, éventuellement selectiveDecision / how-to **en lecture** | Batterie paraphrases → `task.kind` stable, `unknown` seulement si vraiment sans acte | Contrats, SC emit, JUST, entities |
| **F2** | Plus de contrat métier via `orchestrator:${userIntent}` | `intentContractRegistry.js` ; IntentStage télémétrie seulement | Probe : `advise` + pas code → pas `CODE_INTENT` | Typer le SC |
| **F3** | Emit compatible acte + `responseType` sur 1–3 paths non typés | `intentShortCircuit.js` (`inferShortCircuitPathResponseType`) | Path témoin refusé si acte incompatible | Hub SC entier, named_create métier |
| **F4** | Trou utile advise = `direct` + question | commitment + éventuellement G31 slots | Paraphrase sans budget ≠ `unknown` ni clarify bloquant | Nouvelle ontologie produit |

Fiche minimale le jour d’un GO : objectif, périmètre, preuve, invariants (canon + D-20260909), risques + champ `Décision`.

---

## Critères d’un lot « sain » vs « à refuser »

Sain : sert D-20260909, tests de famille, pas d’interdit.  
À refuser : « pour que le téléphone marche », « une regex de plus », « on consume JUST juste pour voir », « on type tout le SC aujourd’hui ».

---

## État actuel de ce plan

| Élément | État |
|---------|------|
| Diagnostic | écrit |
| ADR / 3 D-* index | `accepted` (GO texte 2026-09-10) |
| Index + interdits | écrit |
| GO texte D-* `accepted` | **fait** |
| V — validations de cadrage | **collé FAIL** 2026-09-09 (batterie 19 paraphrases) |
| Lots F1–F4 | **F1 fait** (commité : ebc1dd0). F2–F4 **non ouverts** |
| Runtime | **modifié par F1 seulement** (ebc1dd0, `detectTaskKind` ; `accepted` ≠ lot) ; F2 à F4 non ouverts |
