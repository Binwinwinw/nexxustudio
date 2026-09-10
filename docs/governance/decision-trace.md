# Trace de décision

Mémoire d’architecture consultable **avant d’agir**. Couche manquante, pas un second système.

| Cette page | N’est pas |
|------------|-----------|
| Pourquoi on a tranché, ce qu’il ne faut plus refaire | Le **canon** (quoi respecter) |
| Décisions `proposed` / `accepted` / `superseded` | Le **PLAN** (quoi exécuter après GO de lot) |
| Append-only | Changelog, journal `.memory/`, vault ADR patrimoine |

**GO 2026-09-09** : cette page seulement. Pas de runtime. Pas de lots F1–F4. `.memory/` n’est pas une source normative. V collé le même jour (FAIL batterie) — pas `accepted`.

---

## Règles de lecture avant tâche

Domaine : compréhension d’input, `response_commitment`, contrat, SC, IntentStage.

1. **Interdits actifs** (ci-dessous). Si la solution y figure → stop.
2. **V — validations de cadrage** si la tâche vise `accepted` ou F1 : constat 5 axes collé, sinon stop. V n’est pas F1.
3. **Table des décisions** filtrée par domaine. `proposed` = ne pas coder le contraire. `accepted` = s’y conformer.
4. **Canon** si le comportement runtime est en jeu — [`citadelle-input-invariants.md`](citadelle-input-invariants.md). Pointer, ne pas recopier.
5. **Cartes** si on a besoin du flux réel — liens § Pointeurs. Photos, pas la norme.
6. **PLAN** seulement s’il existe un GO de lot **nommé** — [`dev/PLAN.md`](../../dev/PLAN.md). Cette page n’ouvre aucun lot.

---

## V — validations de cadrage

Porte **séparée de toute étape runtime**. Lecture / probe. Pas F1. Pas un lot.

**Objectif.** Valider que la direction retenue tient réellement sur les paraphrases et sur la télémétrie, **avant** toute acceptation normative et **avant** F1.

**Règle (courte).** Tant que V n’est pas collé et lisible sur les 5 axes, les trois D-* restent `proposed`. Après V collé et GO texte, elles passent `accepted`. F1 reste fermé tant que cette séquence n’est pas tenue.

**État.** Collé 2026-09-09. **FAIL** sur les 5 axes. Probe lecture seule (pas un test, pas F1). D-* restent `proposed`. Runtime inchangé.

**Échantillon live (inclus dans la batterie, pas un cas produit).** Fil Nothing Phone 3a ~12:58 / ~18:44 / ~18:55 / ~20:01. Même chaîne. Confirmé par paraphrase sœurs hors lexicon.

### Batterie collée

19 paraphrases. Axes demandés : advise, compare, currentItem, budget, usage. Voisins : explain, social, code. Hors `mustInclude` lexicon (`conseillerais` / `meilleur` / `vs`) sauf 1 témoin lexicon.

| id | Famille | `task.kind` | Domaine / stratégie | Commitment | `CODE_INTENT` si `user_intent=expert_task` |
|----|---------|-------------|---------------------|------------|--------------------------------------------|
| advise-live | advise | `null` | `unknown` / `full_pipeline` | `evidence_backed_factual` | oui (`orchestrator:expert_task`) |
| advise-no-current | advise | `null` | `unknown` | `evidence_backed_factual` | oui |
| advise-pistes-laptop | advise | `null` | `unknown` | **`unknown`** | oui |
| advise-oriente-velo | advise | `null` | `unknown` | **`unknown`** | oui |
| advise-si-place-casque | advise (shell proche) | `null` | `compare_choose` / guided | `guided_product_comparison` | **oui quand même** |
| advise-conseillerais-lexicon | advise lexicon | `null` | `compare_choose` / `partial_clarify` | `clarify_missing_slots` | **oui quand même** |
| compare-vs-phone | compare | `null` | `compare_choose` / guided | `guided_product_comparison` | **oui quand même** |
| compare-redis | compare | `null` | `training` (pas compare) | `training` | oui |
| compare-ssd | compare | `null` | `compare_choose` / `partial_clarify` | `clarify_missing_slots` | oui |
| current-j-ai-pixel | currentItem | `null` | `unknown` | `unknown` | oui |
| current-pas-encore | currentItem | `null` | `unknown` | `unknown` | oui |
| budget-present | budget | `null` | `unknown` (slot budget=400 lu, ignoré) | `unknown` | oui |
| budget-absent | budget | `null` | `unknown` | `unknown` | oui |
| budget-casque | budget | `null` | `unknown` (`250€` non lu) | `unknown` | oui |
| usage-photo-batterie | usage | `null` | `unknown` (slot usage=photo lu, ignoré) | `unknown` | oui |
| usage-quotidien | usage | `null` | `unknown` | `evidence_backed_factual` | oui |
| explain-cest-quoi | voisin | `null` | `general_knowledge` | `general_knowledge` | oui (classe) |
| social-bonjour | voisin | `null` | `social` / deterministic | `deterministic` | oui **si** classe forcée ; live salut n’y passe pas |
| code-revue | voisin | `null` | `training` | `training` | oui **par guard** `isCodeIntentRequest` |

### Cinq axes — constat

| Axe | Verdict | Lecture |
|-----|---------|---------|
| `task.kind` | **FAIL** | 19/19 `null`. `advise` n’existe pas. `compare` / `debug` / `build` typedef morts. G29 `compare_choose` n’écrit pas l’acte. Lexicon `conseillerais` / `prendrais` allume un **domaine**, pas `task.kind`. Shell « conseils + donnerais », « pistes », « oriente-moi », « tu me conseilles quoi » : sélecteur décisionnel **faux**. |
| `response_commitment` | **FAIL** | Pas dérivé d’un acte. Advise hors lexicon → `unknown` ou `evidence_backed_factual`. `responseType=direct` masque le vide. Lexicon → souvent `clarify` (budget/usage **requis** alors que l’acte est déjà clair). `unknown` sert de fourre-tout. |
| Aval | **FAIL** | `isCodeIntentRequest === false` sur toute la famille advise/compare/slots. `resolveIntentContract(..., { user_intent: "expert_task" })` écrit **`CODE_INTENT` / `orchestrator:expert_task`** y compris quand G29 a déjà `GUIDED_PRODUCT_RECOMMENDATION`. Guard only **non tenu**. |
| Télémétrie | **FAIL** | Live 20:01 = probe advise-live : JUST `general/explain` → IntentStage `expert_task` → `CODE_INTENT` → `skipWebSearch` → COMPOSER `entity_miss`. `matchedBy=orchestrator:expert_task` reproductible. Voisin code : `matchedBy=guard:isCodeIntentRequest` (légitime). |
| Incomplétude | **FAIL** | `currentProduct` GPU-only : Nothing Phone / Pixel nommés **absents** du frame. Budget/usage parfois extraits (`400`, `photo`) mais **non consommés** si domaine `unknown`. Trou utile traité comme vide d’acte (`unknown` + later `entity_miss`), ou comme slot **requis** (`partial_clarify`) dès que le lexicon compare a matché. |

Paraphrase vs shell (ce que F1 devra tenir, pas une regex à coller) : `conseils` ≠ `conseill*` ; `tu me conseilles` ≠ `tu conseilles` ; `ou` nu ≠ `vs` / `ou bien` (Redis/Memcached). Un vert lexicon n’est pas une famille.

Voisins : social deterministic **tient** hors IntentStage. Explain a un domaine G29. Code a un guard. Aucun des trois n’a `task.kind`. Une correction advise ne doit pas les casser ; elle ne doit pas non plus les prendre pour modèle d’autorité d’acte.

Interdit après ce constat : patch produit, regex locale, cas live seul, ouvrir F1, réécrire le pipeline, `accepted` sans GO texte.

**Porte suivante (pas ouverte).** GO **texte** → D-* `accepted` → F1. V collé **n’est pas** `accepted`. V FAIL **n’ouvre pas** F1.

### Cinq axes

| Axe | Couverture | Coller |
|-----|------------|--------|
| `task.kind` | Familles + paraphrases hors lexicon | `task.kind`, `primaryDomain`, paraphrase vs shell |
| `response_commitment` | Dérivé du frame, y compris si `unknown` | `responseType`, `kind`, `renderMode`, `intentContractId` |
| Aval | Aucun contrat métier via une classe ; guards seulement | guard du contrat (`isCodeIntentRequest`, …), `matchedBy` |
| Télémétrie | Cas `orchestrator:*` indésirables | `matchedBy`, échantillon / volume si dispo |
| Incomplétude | Slot utile vs requis | `direct` / `clarify` / `unknown` + slots |

Batterie : paraphrases par acte (advise, explain, translate, diagnose, procedure, create, plan, social), hors `mustInclude`, + un voisin. Pas un cas produit.

Discipline : un FAIL sur un axe **reste un résultat**. V ne prouve pas que le runtime respecte déjà l’ordre cible ; V rend l’ordre (ou sa rupture) **lisible**. Ici : l’ordre cible est **lisible et rompu**.

### Cible de correction (norme, pas lot)

Pas un 4e ID. Les trois D-* ci-dessous portent ça.

1. `requestFrame.task.kind` = autorité de l’acte.
2. `response_commitment` dérivé du frame **par tables**.
3. Les rails n’émettent qu’une forme compatible avec l’acte.
4. COMPOSER / rendu ne requalifient plus la demande.
5. Contrat métier écrit par une classe aval = illégitime si le guard de l’acte ne le permet pas.

Verrous : D-* `proposed` tant que V n’est pas collé (**tenu** : V collé FAIL, toujours `proposed` jusqu’au GO texte). Correction recevable seulement si paraphrases de **famille** passent ensemble. Si le frame dit `advise` et qu’il n’y a pas de guard code, **aucun** runtime ne doit pouvoir écrire `CODE_INTENT`.

Critère de réussite (après lots, pas maintenant) : live Nothing Phone **et** ses paraphrases ; voisins explain / social / code sans régression ; aucun fallback aval ne réintroduit `CODE_INTENT` sur un acte `advise`.

### Ce que V n’est pas

- Pas `accepted`.
- Pas F1–F4, pas de code runtime.
- Pas une raison d’ouvrir un lot « pour que V passe ».

---

## Règles de supersession

- Append-only. On n’efface pas une D-*. On ne réécrit pas son corps pour « corriger l’histoire ».
- Changement de norme = **nouvelle** D-* avec `Supersède: D-ancienne`. L’ancienne : `Statut: superseded` + `Remplacée par` (une ligne de statut seulement).
- Deux `accepted` contradictoires sur le même mécanisme : interdit, sauf `Supersède` explicite.
- `rejected` : option examinée et refusée ; elle reste, pour ne pas la ressortir.
- Statuts : `proposed` | `accepted` | `superseded` | `rejected`.

---

## Interdits actifs

Une tâche qui reproduit une ligne s’arrête, même « pour ce cas ».

| Interdit | Posé par |
|----------|----------|
| 2e NLU consommateur (IntentStage, JUST, NER, packet parallèle) pour combler un vide d’acte | D-20260909-frame-acte-autorite |
| Patch par produit, par incident, ou rail isolé | D-20260909-frame-acte-autorite |
| Contrat métier écrit par une classe aval (`orchestrator:expert_task` → `CODE_INTENT`, etc.) | D-20260909-aval-consommateur |
| Traiter `unknown` comme un fourre-tout neutre | D-20260909-frame-acte-autorite |
| Corriger une formulation uniquement par regex / guard local | D-20260909-frame-acte-autorite |
| Considérer JUST comme l’autorité de routage | D-20260909-frame-acte-autorite · canon inv. 6 |
| Clarifier un slot **utile** comme si c’était un vide d’acte | D-20260909-commitment-derive-du-frame |
| Inventer un champ `entities` ou un extracteur pour « enrichir » | canon inv. 5 |
| Consume JUST ← frame par opportunité | canon inv. 6 |
| Rouvrir un lot clos au passage | canon · PLAN |

---

## Table des décisions actives

Aucune n’est `accepted`. Aucune n’est runtime.

| ID | Statut | Décision (une phrase) | Supersède |
|----|--------|------------------------|-----------|
| D-20260909-frame-acte-autorite | **proposed** | `requestFrame.task.kind` est l’acte ; le cycle est le seul scripteur ; silence de domaine ≠ silence d’acte | — |
| D-20260909-commitment-derive-du-frame | **proposed** | `response_commitment` se dérive du frame par tables ; trou utile → `direct` + slot, pas `unknown` | — |
| D-20260909-aval-consommateur | **proposed** | IntentStage, `orchestrator:*`, SC emit, COMPOSER consomment ; contrats métier = guard only | — |

Cadrage long (diagnostic / plan / ADR unique) : **compagnons**, pas un 4e ID — § Pointeurs.

---

## D-20260909-frame-acte-autorite

| Champ | Valeur |
|-------|--------|
| **ID** | D-20260909-frame-acte-autorite |
| **Date** | 2026-09-09 |
| **Statut** | proposed |
| **Supersède** | — |
| **Domaine** | understanding |

**Décision.** `analyzeRequestIntentFrame` / `understandQuery` écrivent l’acte dans `requestFrame.task.kind`. Un detector de domaine qui se tait ne doit plus produire un vide d’acte. Le typedef (`debug`, `compare`, `procedure`, `build`) doit être tenu via guards **existants**, plus `advise` / `plan` / `social` si l’acte n’y est pas.

**Interdit.** 2e NLU ; NER ; JSON métier parallèle (scores par champ, `consumer_electronics`) ; JUST comme vérité ; patch produit ; regex par incident ; champ `entities` nouveau ; traiter `unknown` comme fallback inoffensif.

**Pourquoi.** Probe 2026-09-09 : silence G29 → `unknown` + `task.kind = null` alors que l’humain demandait une orientation. JUST a étiqueté `explain`. Ce n’est pas l’autorité.

**Conséquence (futur lot, pas maintenant).** F1 — `detectTaskKind`. Hors périmètre : contrats, SC, JUST consume.

**Rejected (conservé).** Frame JSON consommateur / scores 0.92 comme 2e packet.

---

## D-20260909-commitment-derive-du-frame

| Champ | Valeur |
|-------|--------|
| **ID** | D-20260909-commitment-derive-du-frame |
| **Date** | 2026-09-09 |
| **Statut** | proposed |
| **Supersède** | — |
| **Domaine** | commitment |

**Décision.** `resolveResponseCommitment` / `resolveResponseType` lisent le frame. Pas de 2e extracteur. C4 `responseType` reste le job de **reply** (`direct` / `clarify` / `overview` / `scoping`) — pas l’acte. Slot **requis** absent → `clarify`. Slot **utile** absent → `direct` + trou listé. `unknown` réel (bruit) → `CONVERSATION_STANDARD` seulement. `intentContractId` est **licencié** par l’acte, pas par `packet.user_intent`.

**Interdit.** Fusionner `userAct` et `responseType`. Clarify-first systématique (budget/usage) quand l’acte `advise` est déjà clair. Evidence / fraîcheur qui **invente** l’acte.

**Pourquoi.** Le workup peut déjà demander du web (`evidence_backed_factual`) sur un domaine `unknown`. Le livrable n’est pas « conseil d’orientation ». G31 existe ; il n’existe que si compare_choose a matché.

**Conséquence (futur lot, pas maintenant).** F4 après F1. Trancher answer-then-ask vs G31 **par écrit** avant le code.

---

## D-20260909-aval-consommateur

| Champ | Valeur |
|-------|--------|
| **ID** | D-20260909-aval-consommateur |
| **Date** | 2026-09-09 |
| **Statut** | proposed |
| **Supersède** | — |
| **Domaine** | routing |

**Décision.** JUST, IntentStage, fallback `orchestrator:${userIntent}`, SC emit, Sovereign, COMPOSER **consomment**. `CODE_INTENT` / `DIAGNOSTIC` (et tout contrat `skipWebSearch` métier) : **guard only**. `matchedBy: orchestrator:expert_task` = échec de cadrage, pas un routage. C4.2 aujourd’hui ne type que scoping / clarify / overview ; étendre **après** que l’acte et le contrat soient justes.

**Interdit.** Écrire un contrat métier depuis une classe. Blocklist `CODE_INTENT` **seul** (le suivant prend le relais). Typer tout le hub SC d’un coup. Réparer l’ancrage `entity_miss` comme substitut du sujet du frame.

**Pourquoi.** Probe : `isCodeIntentRequest === false` et contrat `CODE_INTENT` via `orchestrator:expert_task`. Le workup voulait le web ; le contrat l’a coupé.

**Conséquence (futur lot, pas maintenant).** F2 puis F3. F3 sans F1–F2 = faux progrès.

---

## Plan de travail dérivé

Pas un GO. Pas dans `dev/PLAN.md` tant qu’un lot n’est pas nommé.

| Étape | Quoi | Condition | Ne pas faire trop tôt |
|-------|------|-----------|------------------------|
| 0 | Cette trace | **fait** (GO doc) | — |
| V | Validations de cadrage (5 axes) | Après 0. **Avant** `accepted` et **avant** F1. **Pas du runtime** | F1 « pour que V passe » |
| 0b | D-* → `accepted` | V collé + GO **texte** | `accepted` sans dumps |
| F1 | `task.kind` tenu | **0b** ; fiche 5 champs + GO **lot** | F1 tant que `proposed` |
| F2 | Plus de contrat par classe | F1 (actes visés) ou V a chiffré l’aspirateur | Blocklist `CODE_INTENT` seul |
| F3 | Emit typé (1–3 paths) | F2 clos | God-file SC entier |
| F4 | Trou utile ≠ `unknown` | F1 + choix produit écrit | G31 clarify avant que `advise` existe |

Transverse : tests par **familles et paraphrases**, pas un cas live.

Critère d’arrêt : Interdit ; V non collé ; `accepted` sans V ; F1 tant que `proposed` ; pas de fiche 5 champs + `Décision: D-…` ; rouge gelé « réparé au passage » ; F3/F4 avant dépendance.

---

## Pointeurs (pas de copie)

| Couche | Lien | Rôle |
|--------|------|------|
| Canon (quoi) | [`citadelle-input-invariants.md`](citadelle-input-invariants.md) | Comportement. Gagne en cas de divergence |
| Gouvernance docs | [`documentation-source-of-truth.md`](documentation-source-of-truth.md) | Hiérarchie des couches |
| Lots (quand GO) | [`../../dev/PLAN.md`](../../dev/PLAN.md) | Registre d’exécution. **Aucun F1–F4 ici** |
| Fiche lot | [`../AI_LOT_TEMPLATE.md`](../AI_LOT_TEMPLATE.md) | 5 champs + `Décision: D-…` le jour d’un GO |
| Carte amont | [`../cartographie/agent-upstream-decision.md`](../cartographie/agent-upstream-decision.md) | §6.5 / U7 — photo |
| C4 | [`../cartographie/c4-response-type-decision.md`](../cartographie/c4-response-type-decision.md) | Job de reply, pas l’acte |
| PRE_EMIT | [`../cartographie/pre-emit-coherence.md`](../cartographie/pre-emit-coherence.md) | Rails non typés |
| Compréhension | [`../cartographie/agent-comprehension-conversation.md`](../cartographie/agent-comprehension-conversation.md) | Cycle lot 2 |
| Diagnostic compagnon | [`from-input-understanding-to-authoritative-routing.md`](from-input-understanding-to-authoritative-routing.md) | Analyse. Pas une D-* |
| Plan compagnon (détail) | [`plan-authoritative-input-understanding.md`](plan-authoritative-input-understanding.md) | Détail V / faux progrès. La **norme d’ordre** est le tableau ci-dessus |
| Cadrage long unique | [`decisions/D-20260909-input-understanding-authority.md`](decisions/D-20260909-input-understanding-authority.md) | Brouillon long. **Pas** un 4e ID. Les trois D-* de cette page font foi |
| `.memory/decisions.md` | journal secondaire rang 4 | Ne plus y verser d’architecture input / routing |
| Vault ADR | `citadelle-vault/.../adr/` | Patrimoine. Cette trace n’y migre pas par défaut |

---

## Maintenance

- Nouvelle décision : section D-* dans **cette** page + ligne dans la table. Dossier `decisions/` seulement si l’index dépasse une page utile.
- Lot futur : PLAN + fiche. Cette page ne s’allonge pas d’un changelog de lots.
- Runtime inchangé tant que les D-* sont `proposed` et qu’aucun GO de lot n’existe.
