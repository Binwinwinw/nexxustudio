# Chantier — compréhension d’input (Citadelle)

Mémoire de chantier. Historique des lots. **Pas** la source de vérité du comportement.

**Gouvernance (canon)** : [`docs/governance/citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md)

Les sections ci-dessous sont l’**historique** P0–P2. Elles ne gouvernent plus. Si conflit : le canon gagne.

**État** : 2026-08-17 — chantier compréhension d’input **fermé** (P0–P2 faits, P3–P5 non ouverts). Lots conversation fermés : cadrage sujet / contexte (invariant 8) ; ancrage Vision (invariant 9) ; refus COMPOSER Vision (invariant 10) ; complétude d’input / clause d’existence (invariant 11).

**Sources** : runtime `agentPipeline.run`, `nexxusAgentCycle`, policies conversation / intent. Canvas d’inventaire : hors dépôt (Cursor).

**Protocole** : [`docs/AI_EXECUTION_LOOP.md`](../AI_EXECUTION_LOOP.md).

**Voir aussi** : [query-understanding-g29-spec.md](query-understanding-g29-spec.md), [intent-frame-and-decomposition.md](intent-frame-and-decomposition.md), [nexxus-routing-behavior-registry-v1.md](nexxus-routing-behavior-registry-v1.md), [attachment-read-mandate-v1.md](attachment-read-mandate-v1.md).

---

## Chaîne réelle

```
triageUserIntentAsync
  → decomposeRequest
  → runAgentUnderstandingPhase          ← orchestrateur de compréhension (déjà là)
       ├─ understandQuery               ← G29 + requestFrame
       ├─ buildRequestWorkup            ← cycle cognitif 4 blocs
       └─ buildTurnComprehension        ← projection, pas un 2e parse
  → buildExecutionPlan                  ← décrit, n’exécute pas
  → evaluateJustIntent(query)           ← 2e lecture aujourd’hui (dette P1)
  → resolveClarificationGate            ← JUST + triage + turnComprehension
  → runConversationShortCircuit         ← premier match gagne
  → SovereignOrchestrator.orchestrate   ← aval (RAG, experts). Pas le parseur.
```

`SovereignOrchestrator` consomme `queryUnderstanding` / `requestWorkup`. Il n’orchestre pas la compréhension.

`understandQuery` appelle déjà `analyzeRequestIntentFrame` et attache `requestFrame`.  
`projectFrameToJustIntentHints` + `compareJustIntentToFrameHints` : branchés en **shadow télémétrie** seulement.  
`evaluateJustIntent(query)` ne prend toujours que la query. Le verdict JUST servi au gate / SC n’est pas projeté depuis le frame.

---

## Structurant — ne pas casser

- `understandQuery` + `buildRequestWorkup` = source de vérité structurelle.
- `runAgentUnderstandingPhase` = seul orchestrateur amont. Pas de 2e NLU.
- Triple normalisation : `sanitizeQuery` ≠ `normalizeForParse` ≠ `normalizeText`.
- Clarification gouvernee : `CLARIFICATION_DECISION_V1`, `conversationMoveAuthority`, `can_answer_now`. Mandat PJ interdit clarify d’objectif.
- LLM fail-closed (triage tie-break, semantic resolver whitelist).
- Short-circuit : premier match gagne. Ordre documenté.
- `activeGoalPolicy`, T1/T2/T3, warmup, composer global, `routerAgent`, rail DOCUMENT : hors chantier.
- Confiances multi-échelles (ordinal JUST/frame, numérique G46/triage, binaire mandat). Pas de score unique.
- `health-incidents.jsonl` = santé stream. Pas un journal de méprise.

---

## Dettes utiles

- JUST et le frame lisent encore la même query en parallèle pour la **décision**. P1 observe l’écart ; consume toujours interdit.
- `turnComprehension.entities` : projection P2 **fermée**. Liste de champs : voir le canon. Ne plus enrichir ici.
- `intentCompositionPolicy` : observe P0, pas d’enforcement.
- `semanticIntentResolver` : shadow / assist restreint (`time_lookup`, `social_checkin`).
- Journal : méprises surtout console `[JUST_INTENT]` / `[G46]` / `[INTENT_FRAME]`.
- Spec G29 cite encore d’anciens chemins `policies/conversationQueryUnderstanding.js` (drift doc).

---

## Manque réel

1. Consume JUST ← frame : **interdit** tant que les conditions globales ci-dessous ne sont pas toutes vertes.
2. `turnComprehension.entities` : **P2 fermé**. Tout champ nouveau = lot autonome (canon).
3. Event `comprehension_failure` séparé de `health-incidents` (**P3**).
4. Paquet télémétrie unique du tour, observe only (**P4**).
5. Gaps G30.2–G30.6 : seulement si incident (**P5**).

Pas de NER global. Pas d’orchestrateur NLU. Pas de sanitizer unique.

---

## Risques si on duplique les couches

| Reco générique | Effet ici |
|----------------|-----------|
| Orchestrateur NLU neuf | Double `runAgentUnderstandingPhase`. Doctrine agent unique meurt. |
| Sanitizer unique | Casse familiarité + G29 + clarify. |
| Score de confiance unique | Mélange JUST ordinal, G46 numérique, mandat binaire. Routage instable. |
| Module clarify parallèle | Contourne `can_answer_now` et le mandat PJ. Retour piste / clarify objectif. |
| Planner tool-loop | Court-circuite `buildExecutionPlan` + conversationMove + dictionary. |
| LLM amont systématique | Perd fail-closed et souveraineté locale. |
| Journal unique health + méprise | Noye les vrais incidents stream. |

---

## Plan P0 → P5

| Phase | Geste | Statut |
|-------|--------|--------|
| **P0** | Gel. Inventaire. Zéro diff runtime. | Fait (cette page). |
| **P1** | JUST lit le frame en **shadow**. Consume après preuve. | **Fermé** — shadow validé, consume interdit. |
| **P2** | `turnComprehension.entities` depuis extracteurs existants. | **Fermé** — projection packet, pas d’interprétation. |
| **P3** | JSONL `comprehension_failure`. | Plus tard. |
| **P4** | Paquet télémétrie tour (observe). Aucun seuil SC neuf. | Plus tard. |
| **P5** | Un gap G30 seulement si douleur. | Plus tard. |

---

## Lot P1 — JUST ← frame (shadow d’abord)

### Objectif

Observer l’écart entre `evaluateJustIntent(query)` et `projectFrameToJustIntentHints(requestFrame)` **sans changer** domaine / action / stratégie / clarification / short-circuit.

Consume = lot suivant, **après** preuves collées. Pas dans le même commit que le shadow si le consume change un verdict.

### Fichiers visés (code, quand le lot s’exécute)

| Fichier | Rôle P1 shadow |
|---------|----------------|
| `server/src/agent/agentPipeline.js` | Point de branchement. Passer `justIntent` déjà calculé + `queryUnderstanding.requestFrame` à la télémétrie. **Ne pas** changer l’objet `justIntent` servi au gate / SC. |
| `server/src/agent/telemetry/justIntentTelemetry.js` | Émettre les champs shadow (hints + divergence). Réutiliser l’évaluation déjà faite : ne plus rappeler `evaluateJustIntent(query)` à l’aveugle. |
| `server/src/agent/policies/intent/requestIntentFrame.js` | Réutiliser `projectFrameToJustIntentHints`. Ajouter **ici** (pas un nouveau module) un comparateur de **compatibilité**, pas d’égalité brute. |
| `server/src/agent/policies/intent/justIntentDetectionPolicy.js` | **Inchangé en shadow.** Signature `evaluateJustIntent(query)` reste. Consume éventuel = 2e argument optionnel, plus tard. |

Hors touch : `intentTriageClassifier.js`, `clarificationDecisionPolicy.js`, `intentShortCircuit.js`, `nexxusAgentCycle.js`, `SovereignOrchestrator.js`, `activeGoalPolicy.js`, composer, rail DOCUMENT.

### Point de branchement

`agentPipeline.js` après :

```
const justIntent = evaluateJustIntent(pipelineQuery);
```

Le frame est déjà là : `queryUnderstanding.requestFrame`.

```
hints = projectFrameToJustIntentHints(queryUnderstanding.requestFrame)
compare = compat(justIntent, hints)     // observe
recordJustIntentTelemetry(..., { justIntent, frameHints: hints, compare })
```

`justIntent` transmis à `resolveClarificationGate` et `runConversationShortCircuit` = **le même objet qu’aujourd’hui**.

### Données lues

- `pipelineQuery` (déjà).
- `queryUnderstanding.requestFrame` (déjà produit par `understandQuery`).
- Sortie actuelle de `evaluateJustIntent` : `domain`, `action`, `strategy`, `confidence`, `signals`.

### Données émises (shadow)

Champs ajoutés à l’event `[JUST_INTENT]` existant, ou ligne sœur dans le même writer :

- `frame_task_kind`, `frame_domain_kind`, `frame_family_hint`, `frame_family_confidence`
- `hint_domain`, `hint_action`, `hint_family_id`, `hint_preempt_family`
- `just_domain`, `just_action`, `just_strategy`
- `shadow_compatible` : `true` \| `false` \| `null` (null = pas de hint, `task.kind` absent)
- `shadow_reason` : `match` \| `compatible` \| `vocab_mismatch` \| `social_vs_work` \| `action_mismatch` \| `no_hint`

Pas de nouveau fichier JSONL en P1. Pas de nouveau module.

### Vocabulaire — ne pas comparer en égalité brute

`projectFrameToJustIntentHints` parle `technical` / `plan`. JUST parle `code` \| `web_html` \| `general` et `explain` \| `plan` \| `create`.

Compatibilité shadow (à coder dans `requestIntentFrame.js`) :

| Hint frame | JUST compatible |
|------------|-----------------|
| `domain: technical` | `code`, `web_html`, `analysis`, `data`, `general` (JUST n’émet pas `technical`) |
| `domain: pedagogical` | `general` + signaux pédagogie ; pas `code` create |
| `domain: general` | `general`, `writing`, `document` |
| `action: explain` | `explain` |
| `action: plan` | `plan` |
| `action: translate` | `translate` |
| `task.kind == null` + `socialOnly` | `social` / `social_checkin` |
| pas de hint | `shadow_compatible = null` — pas une divergence |

`vocab_mismatch` (hint `technical` vs JUST `code`) ≠ `social_vs_work`. Seul le second bloque un futur consume.

### Ce qui reste inchangé (shadow)

- Verdict JUST (`domain`, `action`, `deliverable`, `strategy`, `confidence`).
- Triage (déjà calculé avant).
- `resolveClarificationGate` (même `justIntent`).
- Short-circuit (même `options.justIntent`).
- `evaluateJustIntent` dans `guidedCreationScopingPolicy.js` (hors P1).
- Seuils `JUST_INTENT_THRESHOLDS`.
- Ordre pipeline.

### Tests à ajouter ou adapter

Fichiers existants — pas de nouveau harness :

- `server/tests/request-intent-frame.test.js` — étendre : comparateur de compatibilité (safe pairs + `social_vs_work` + `no_hint`).
- `server/tests/just-intent-detection-policy.test.js` — **inchangé fonctionnellement** en shadow ; éventuellement assert que `evaluateJustIntent(q)` === `evaluateJustIntent(q)` bit-à-bit avant/après (garde anti-consume accidentel).
- `server/tests/request-intent-frame-telemetry.test.js` — champs shadow présents, `shadow_compatible` renseigné.
- Relance non-régression : `intent-frame-ambiguity-battery.test.js`, `conversation-intent-frame.test.js`, `conversation-query-understanding.test.js`.

Pas de test SC/clarify qui attend un nouveau path en P1 shadow.

### Preuves avant shadow → consume

Consume autorisé seulement si **toutes** les cases sont vraies :

1. Batteries ci-dessus : fail 0. Sortie collée.
2. Sur le jeu frame déjà testé (`technical_learning_path`, `technical_overview`, `career_learning_path`, social pur, composite salut+React) : zéro `social_vs_work`.
3. `vocab_mismatch` documenté (ex. `technical` vs `code`) : compté, **pas** traité comme blocage.
4. Diff runtime shadow : `justIntent` servi au gate/SC **identique** à HEAD (même `domain`/`action`/`strategy` sur la battery JUST existante).
5. Aucun nouveau `needs_clarification` introduit par P1 (gate inchangée).
6. Aucun path SC changé sur `request-intent-frame` « alignement frame ↔ short-circuit ».
7. Logs : event shadow visible ; `health-incidents.jsonl` non écrit par ce lot.

Si une case manque : rester en shadow. Ne pas « essayer » le consume.

### Risques de régression P1

| Surface | Risque | Mitigation shadow |
|---------|--------|-------------------|
| Divergence frame / JUST | Faux positifs si égalité `technical === code`. Faux consume si on écrase JUST. | Comparateur de compatibilité. JUST non muté. |
| Triage | Aucun si on ne touche pas `triageUserIntentAsync`. Risque seulement si on « aligne » JUST trop tôt et que le gate croit JUST plus que triage. | Gate reçoit le même JUST. |
| Clarification | JUST `CLARIFY_THEN_BUILD` / `can_answer_now` changé = clarify en trop ou en moins. | Shadow n’écrit pas la stratégie. |
| Short-circuit | `options.justIntent` lu par quelques rails. Un JUST social sur une query work (ou l’inverse) déplace un path. | Même objet JUST. Battery frame↔SC inchangée. |
| Logs / observabilité | `recordJustIntentTelemetry` ré-évalue JUST aujourd’hui. Changer la signature sans garder l’event casse les lecteurs console. Double parse frame si on rappelle `analyzeRequestIntentFrame`. | Étendre l’event. Réutiliser `justIntent` + `requestFrame` déjà là. Pas de JSONL neuf. |

### Hors périmètre P1

Nouveau module NLU. Score unique. NER. Refonte JUST. Brancher `guidedCreationScopingPolicy`. Fusion des échelles de confiance. Correction des rouges préexistants. P2–P5. Consume.

---

## Clôture P1 — 2026-08-15

**Verdict : shadow validé, consume interdit. P1 fermé.**

### Modifié (périmètre P1)

| Fichier | Geste |
|---------|--------|
| `requestIntentFrame.js` | `compareJustIntentToFrameHints` (compatibilité, pas égalité brute). `technical` inclut `general` côté JUST. |
| `justIntentTelemetry.js` | Champs shadow sur l’event `[JUST_INTENT]`. Réutilise `justIntent` + `requestFrame` déjà calculés. |
| `agentPipeline.js` | Un appel : `recordJustIntentTelemetry(query, { justIntent, requestFrame })` juste après `evaluateJustIntent`. |
| `request-intent-frame.test.js` | Suite comparateur + garde `social_vs_work` sur JUST réel. |
| `just-intent-detection-policy.test.js` | Event enrichi + freeze JUST. |

### Inchangé

- Signature et verdict de `evaluateJustIntent(query)`.
- Objet `justIntent` servi à `resolveClarificationGate` et `runConversationShortCircuit` (même référence).
- Triage, clarification, short-circuit, seuils `JUST_INTENT_THRESHOLDS`.
- `justIntentDetectionPolicy.js`, `nexxusAgentCycle.js`, `SovereignOrchestrator.js`.
- `health-incidents.jsonl` : ce lot n’y écrit pas.

### Vert P1

- Comparateur : 10/10.
- JUST policy + garde anti-consume : 19/19.
- `request-intent-frame-telemetry` : 2/2.
- `conversation-query-understanding` (G29) : pass.
- Alignement frame ↔ SC (échantillon Redis / fiches / career) : pass.
- Jeu canonique + JUST réel : zéro `social_vs_work`.
- Event enrichi visible (`hint_*`, `shadow_compatible`, `shadow_reason`). Ex. `explique Redis` → `vocab_mismatch`, compatible.

### Rouge préexistant — gelé hors P1

Ne pas corriger dans ce chantier tant qu’un lot dédié n’est pas ouvert.

| Test | Symptôme | Fichier |
|------|----------|---------|
| `composite — task.kind prioritaire sur social` | `task.kind` null au lieu de `explain` sur « salut, tu peux m'aider sur React ? » | `request-intent-frame.test.js` |
| `routing: composite → pas social_deterministic seul` | SC reste `social_deterministic` sur « salut comment ça va, tu peux m'expliquer les hooks ? » | `conversation-intent-frame.test.js` |
| Ambiguïté #9 | « Salut, je veux un plan pour apprendre React pour trouver un job » → `career_learning_path` au lieu de `technical_learning_path` | `intent-frame-ambiguity-battery.test.js` |
| Corpus clarify `encyclopedic_familiarity` / `explanatory_general_knowledge` | Paths `familiarity_deterministic` vs IS / social / domain_overview | `clarification-decision-policy.test.js` |

Ces rouges existaient avant le comparateur et le branchement shadow. P1 n’a pas touché `detectTaskKind`, le SC, ni la gate.

### Hors périmètre (rappel)

Consume JUST. NER. Score unique. Nouveau module. T1/T2/T3, warmup, `activeGoalPolicy`, composer, rail DOCUMENT. Réparation opportuniste des 4 rouges ci-dessus.

### 7 conditions — état au moment de la clôture

| # | Condition | État |
|---|-----------|------|
| 1 | Batteries P1 fail 0 | **Vert** (comparateur, JUST, telemetry, G29). **Pas vert** si on exige fail 0 sur les 4 rouges préexistants. |
| 2 | Jeu canonique : zéro `social_vs_work` | **Vert** (hors composite déjà rouge hors P1) |
| 3 | `vocab_mismatch` compté, pas bloquant | **Vert** |
| 4 | `justIntent` servi identique (pas de mutation) | **Vert** |
| 5 | Aucun `needs_clarification` nouveau | **Vert** (gate non touchée) |
| 6 | Paths SC échantillon inchangés | **Vert** ; #9 / composite = rouge préexistant |
| 7 | Pas d’écriture `health-incidents` | **Vert** |

### Condition d’ouverture future de consume

Consume = **autre lot**, pas une suite automatique de P1. Autorisé seulement si :

1. Les 7 conditions sont vertes **y compris** fail 0 sur les batteries qu’on choisit d’inclure, **ou** les 4 rouges préexistants sont explicitement exclus par un lot dédié (pas « réparés au passage »).
2. Un plan consume séparé : 2e argument optionnel de `evaluateJustIntent`, shadow d’abord sur les cas `social_vs_work` restants, batteries JUST + clarify + SC recollées.
3. Aucun élargissement (NER, score unique, P2) dans le même commit.

Tant que (1) n’est pas tranché : **consume interdit**.

### Pourquoi P1 reste en shadow

- Pas de mutation runtime : le JUST consommé est l’objet produit par `evaluateJustIntent(query)`, inchangé.
- Pas de bascule implicite : les champs shadow n’alimentent ni la gate, ni le SC, ni les seuils.
- Consume interdit tant que les conditions globales ne sont pas remplies. Observer n’est pas décider.

---

## Porte P2 — cadrage validable (pas de code)

**État** : inventaire fait. Implémentation interdite tant que cette porte n’est pas acceptée.

### Où ça vit

| Rôle | Fichier |
|------|---------|
| Writer unique | `server/src/agent/policies/conversation/turnComprehension.js` → `buildTurnComprehension` L186–190 (`entities` encore vides sauf `attachments` booléen) |
| Appelant | `nexxusAgentCycle.js` → `runAgentUnderstandingPhase` passe déjà `understanding` + `options.attachments` |
| Sujet transversal (IS/GK) | `conversationSubjectExtraction.js` → `extractConversationSubject` (null hors IS/GK) |
| Cible déjà sur le packet | `understanding.requestFrame.domain.target` (posé par `analyzeRequestIntentFrame` **dans** `understandQuery`) |
| Noms PJ déjà dans le flux | `options.attachments` (`originalname` / `name` / `filename`) |

`buildTurnComprehension` a déjà `understanding` (dont `requestFrame`) et `options.attachments`. Pas besoin d’un 2e `understandQuery` si `options.understanding` est fourni (cas pipeline).

### Cartographie extracteurs

| Candidat | Déjà calculé au moment de `buildTurnComprehension` ? | P2 |
|----------|------------------------------------------------------|-----|
| `requestFrame.domain.target` | Oui, dans `understandQuery` | **Oui — sujets** |
| `intents[].task` (slots learning) | Oui, si le registre a attaché `task` | **Oui — sujet si label/domain déjà là** |
| `options.attachments` noms | Oui, passés par le cycle | **Oui — sources** |
| `extractConversationSubject(query)` | Non : relance IS/GK | Non (2e parse) |
| `extractLocalitySlot` / `compositeQueryFrameParser` | Non : parse météo plus tard (SC) | **Non — localités hors P2** |
| `salientSpanExtractor` | Texte assistant n−1, pas le packet | Non (autre job) |
| `extractSubjectCandidate` / `subjectGraph` | Autre parse / catalogue | Non (NER/catalogue déguisé) |
| `extractTemporalTarget` | Autre axe (temps, pas localité) | Non |

**Localités :** aucun slot localité n’existe sur le packet `understanding` à cet instant. Les remplir = 2e parse météo **ou** élargir `understandQuery`. Les deux sortent de « `buildTurnComprehension` seulement + pas de 2e parse ». Donc `entities.localities` reste `[]` en P2. Ce n’est pas un trou à boucher dans ce lot.

### Meilleure façon (projection, pas couche)

Une fonction locale dans `turnComprehension.js` (pas un module neuf) :

```
subjects = unique non-vides de requestFrame.domain.target
           + intents[].task.domainLabel / techLabel s’ils existent déjà
sources  = noms de options.attachments (originalname | name | filename)
localities = []
attachments = Boolean(options.attachments?.length)  // déjà là
```

Zéro appel à `extractConversationSubject`, zéro parser météo, zéro graphe.

Alignement attendu : sur IS/overview où le frame a déjà un `target`, `subjects[0]` == ce target. Sur GK sans `target` frame : `subjects` vide — **pas** un rappel de `extractConversationSubject` pour « rattraper ».

### Plan P2 minimal (quand la porte est validée)

| | |
|--|--|
| Fichiers visés | `turnComprehension.js` seulement (+ tests `turn-loop-comprehension.test.js`) |
| Données lues | `understanding.requestFrame`, `understanding.intents`, `options.attachments` |
| Données émises | `entities.subjects`, `entities.sources` ; `localities` inchangé `[]` ; `attachments` inchangé |
| Invariants | `primaryGoal`, `dominance`, `mayFinalizeSocial`, JUST, gate, SC, P1 shadow |
| Tests | social pur → subjects/sources vides, mayFinalizeSocial true ; « explique Redis » → subject depuis frame.target ; PJ `{ originalname }` → sources = [nom], pas d’ingest ; météo Martinique → localities `[]`, workPresent inchangé |
| Preuve avant mutation | ce cadrage accepté ; fail 0 sur `turn-loop-comprehension` **avant** le diff |

### Risques de dérive

| Dérive | Pourquoi c’est hors cadre |
|--------|---------------------------|
| 2e parse | Rappeler `extractConversationSubject` / `extractLocalitySlot` / `understandQuery` si `options.understanding` manque (le fallback L62–63 existe déjà — P2 ne doit pas en ajouter un) |
| NER déguisé | `subjectGraph`, spans assistant, heuristique « nom propre = sujet » |
| Couplage SC/clarify | Lire `entities` dans `intentShortCircuit` ou `clarificationDecisionPolicy` |
| Entités « universelles » | Remplir subjects hors frame.target (tout token, tout GK) |

### Critères de validation

1. Diff = `turnComprehension.js` + tests turn-loop. Rien d’autre.
2. Aucun import nouveau hors lecture de champs déjà sur `understanding` / `attachments`.
3. `evaluateJustIntent` / gate / SC / P1 shadow : bit-à-bit inchangés.
4. Social : `entities.subjects.length === 0`, `mayFinalizeSocial` true.
5. Frame avec `domain.target` : ce target apparaît dans `subjects`.
6. PJ : `sources` = noms, aucun buffer / ingest.
7. Localités : toujours `[]` en P2. Pas un échec.

Si un critère pousse à parser à nouveau ou à créer un module : **hors périmètre**.

### Clôture P2 — 2026-08-15

**Verdict : P2 validé, fermé.** Plus aucun enrichissement de cette projection.

**Périmètre exact** : copier des signaux déjà sur le packet de turn. Writer unique : `projectTurnEntities` dans `turnComprehension.js`. Tests : `turn-loop-comprehension.test.js` (suite P2).

**Règle** : `entities` copie le packet. Trim + unique. Pas d’interprétation, pas d’extracteur, pas de NER, pas de label « amélioré ».

**Champs projetés (liste fermée)** :

| Champ | Copie de | Interdit |
|-------|----------|----------|
| `subjects` | `requestFrame.domain.target` + `intents[].task.{domainLabel,techLabel,target,targetRoleLabel}` | labels de famille, tokens inventés |
| `sources` | `originalname` \| `name` \| `filename` | buffer, ingest |
| `localities` | toujours `[]` | parse météo, 2e extracteur |
| `attachments` | `Boolean(attachments.length)` | autre sémantique |

Aucun champ nouveau dans `entities` par opportunité. Brancher un extracteur pour « enrichir P2 » = hors lot. Coupler `entities` vers SC / clarify / JUST = hors lot.

**Fichiers modifiés** : `turnComprehension.js`, `turn-loop-comprehension.test.js`.

**Gel explicite** : le rouge `SC bonjour → social_deterministic verified` (`verified_ok` attendu, `null` obtenu) reste **hors lot P2**, explicitement gelé. Ne pas le « réparer » via `entities`.

**Preuve** : P2 5/5 ; lots 1–2 + engage pass ; JUST / gate / SC / P1 inchangés.

---

## Porte P3 — journal méprise (pas ouvert, pas de code)

Utile seulement pour observer les échecs de compréhension. Pas pour enrichir `entities` ni consommer JUST.

| | |
|--|--|
| Objectif | Enregistrer une méprise (misclassif, `social_vs_work`, pivot) hors `health-incidents`. |
| Périmètre | Un writer télémétrie existant ou un JSONL dédié. Observe only. |
| Risques | Noyer le stream health ; faire décider le routage d’après le journal ; rouvrir P1 consume / P2 entities. |
| Preuve | 1 event, 1 test persist ; `health-incidents` inchangé ; SC / gate / JUST / `entities` bit-à-bit. |
| Invariants | P1 reste shadow. P2 liste de champs fermée. Pas de NER. Pas de 2e parse. |

N’ouvrir P3 que sur douleur réelle (méprises invisibles). Sinon le chantier s’arrête ici.

---

## Statut du chantier compréhension d’input

- Analyse / P0 : **fermées**.
- P1 : **fermé** — shadow validé, consume interdit.
- P2 : **fermé** — projection stricte, liste de champs fermée. Rouge SC bonjour gelé hors lot.
- P3–P5 : **non ouverts**. Portes seulement.

---

## État final — gouvernance (2026-08-15)

Règles, interdits, rouges gelés, ouverture/fermeture de lot : **uniquement** le canon  
[`docs/governance/citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md).

| Phase | Statut |
|-------|--------|
| P0 inventaire | Fermé |
| P1 shadow JUST ← frame | Fermé |
| P2 projection `entities` | Fermé |
| P3–P5 | Non ouverts |

**Statut : chantier compréhension d’input fermé.** P3–P5 non ouverts.

---

## Lot fermé — Correction de cadrage conversationnel (2026-08-16)

Hors P3–P5. Ne rouvre pas le chantier compréhension d’input.  
Règle durable : [`citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md) **invariant 8**. Cette section est l’historique, pas une seconde source.

### Bug initial

Tour 1 — *« est-ce que tu connais le créole … par exemple en Martinique ? »*  
→ *« Tu parles de Martinique ? Si oui, je vois. »* (`social_deterministic` / clarify épistémique).

Tour 2 — *« le principal n’était pas … martinique, c’était … le créole »*  
→ rewrite `On discute de…` + web. Mauvais sujet hérité.

### Cause racine

- `extractObscureReferenceHint` prenait le **dernier** token capitalisé (`Martinique`). `créole` minuscule invisible. `par exemple` ignoré.
- Pas de rail `ce n’est pas X, c’est Y`. Correction lue comme suite de chat.
- `CONFIRM_SUBJECT_PATTERN` trop étroit ; clarify ouvrait un fil social ; `extractSocialChatTopic` / `continuityEffectiveQuery` réécrivaient la phrase.
- Porte de suffisance : cadrage renvoyé vers `multi_segment_composite` (web) avant sujet stable.

### Règles posées par ce lot (gouvernées par l’invariant 8)

- **Sujet / contexte / exemple** : un exemple ou un lieu (`par exemple`, `en`, `dans`) ne remplace pas le sujet lexical déjà clair.
- **Correction** : `ce n’est pas X, c’est Y` / `le principal n’est pas X, c’est Y` / `je parle de Y, pas de X` remplace immédiatement l’hypothèse. Pas une suite de chat.
- **Web** : interdit tant que le sujet corrigé n’est pas stabilisé (`blockWebUntilFramingStable`).

### Hors lot — explicite

- `turnComprehension.entities` : **hors lot**. Pas de couplage SC.
- Pas de 2e NLU. Pas de nouveau parse.
- Pas de correction opportuniste via sanitation web, volume adaptatif, ou shape FACTUAL.
- Ranking inchangé.

### Fichiers touchés

| Fichier | Geste |
|---------|--------|
| `conversationFramingPolicy.js` | Rail sujet / contexte / exemple + correction |
| `epistemicUncertaintyResolutionPolicy.js` | Plus de dernier capitalisé si sujet lexical clair |
| `socialChatContinuityPolicy.js` | Correction ≠ follow-up social ; pas de `On discute de…` |
| `conversationContinuityContext.js` | `CONFIRM_SUBJECT_PATTERN` |
| `intentShortCircuit.js` | Rails cadrage avant continuité / web ; hors porte suffisance |
| `agentPipeline.js` | Bloque rewrite + web si cadrage instable |
| `conversation/index.js` | Export |
| `conversation-framing-subject-context.test.js` | Preuve cas 1–6 |

### Tests verts

- Cadrage 10/10 (`conversation-framing-subject-context.test.js`) — cas 1–6 du lot.
- Régression : epistemic NXT 6/6 ; social continuity 24/24.

### Verdict

**Lot validé, fermé.** Doctrine stabilisée au canon (invariant 8).  
Phrase réutilisable : *sujet clair reste sujet ; exemple reste exemple ; correction utilisateur remplace l’hypothèse ; pas de web avant cadrage stable.*

---

## Lot fermé — Correction de l’ancrage Vision — exemption entity_miss (2026-08-16)

Hors P3–P5. Ne rouvre pas le chantier compréhension d’input.  
Règle durable : [`citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md) **invariant 9**. Cette section est l’historique, pas une seconde source.

### Bug initial

*« fait un description de la photo jointe »* + image → pipeline `VISION_ATTACHED` (~3 min), COMPOSER produit une description.  
Puis `🛡️ Ancrage tour courant — entity_miss` remplace le texte par *« Ta demande porte sur description de la photo jointe. La réponse prête recyclait un cadre hors sujet… »*.

### Cause racine

`NAMED_ARTIFACT_RE` lit *un description de la photo jointe* comme artefact nommé. `requiresEntitySurface` exige ces mots dans la réponse. Une description visuelle (*portrait*, *logo*, *cyan*) ne les répète pas → `entity_miss` → `buildAnchoringRepair`.  
`_finalizePipelineTurn` n’envoyait ni contrat, ni images, ni `vision_failed`. Path live = `COMPOSER`. Ce n’était pas un recycle du check-in social.

### Règle d’exemption (gouvernée par l’invariant 9)

Les **trois** à la fois : `intentContractId === "VISION_ATTACHED"` + image réellement jointe + `isAttachedVisionRequest`.  
Alors : skip **seulement** `entity_miss` lexical. Vide / `vision_failed` → erreur honnête, jamais *recyclait*.

### Ancrage textuel vs visuel

| | Textuel | Vision attachée |
|--|---------|-----------------|
| Ancre | Sujet / livrable nommé dans la phrase | Fichier image du tour |
| Preuve | La réponse nomme ce sujet | Analyse non vide |
| Échec | `entity_miss` légitime | Erreur honnête, pas le repair méta |

### Hors lot — explicite

- `entity_miss` **reste actif** hors Vision.
- Exemption = contrat + image réelle + requête Vision explicite. Pas un seul de ces trois.
- `foreign_template` **reste actif** sous exemption.
- Pas de changement du modèle Vision, de l’ingestion, du routage, du volume adaptatif, du shape FACTUAL, ni du ranking.

### Fichiers touchés

| Fichier | Geste |
|---------|--------|
| `agentPipeline.js` | Passe `intentContractId`, `attachments`, `visionFailed` à la garde |
| `currentTurnAnchoringPolicy.js` | Exemption ciblée + repair Vision honnête |
| `current-turn-anchoring.test.js` | Suite Vision, cas 1–8 |

### Tests verts

- Suite Vision 9/9 (cas 1–8 + `foreign_template` sous exemption).
- Ancrage existant + `active_goal` : 35/35.

### Verdict

**Lot validé, fermé.** Doctrine stabilisée au canon (invariant 9).  
Phrase réutilisable : *En Vision attachée, l’image est l’ancre du tour ; l’ancrage lexical ne doit pas rejeter une description visuelle valide.*

---

## Lot fermé — Correction du refus COMPOSER sur Vision attachée (2026-08-16)

Hors P3–P5. Ne rouvre pas le chantier compréhension d’input. Ne rouvre pas l’ancrage `entity_miss` (invariant 9).  
Règle durable : [`citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md) **invariant 10**. Cette section est l’historique, pas une seconde source.

### Bug initial

*« fait un description de la photo jointe »* + PNG → `VISION_ATTACHED`, briefing produit, COMPOSER livre *« Je vois la piste, mais pas encore la destination… »*.

### Cause racine

`allowRefusal: true` persistait pour les images jointes, contrairement aux documents texte (`has_attached_documents`). `REFUSAL_RULE` du prompt COMPOSER livrait `INSUFFICIENT_SIGNAL_REFUSAL`. Le filet document ne partait pas. L’exemption `entity_miss` (lot fermé) laissait passer la phrase.

`social_continuity` observe : télémétrie seulement, pas la cause.

### Correctif

Désactivation ciblée de `allowRefusal` si `VISION_ATTACHED` + image réelle + demande Vision explicite.  
Filet `resolveVisionAttachedComposerDelivery` : piste/vide → briefing si non vide ; `vision_failed` / briefing vide → erreur honnête. Pas le fallback document.

### Non-régression — explicite

- Document texte : fallback inchangé.
- Demande vague sans image : refus / clarify encore possibles.
- Lot `entity_miss` : inchangé.
- Modèle Vision, ingestion, routage, volume, shape FACTUAL, ranking : hors lot.

### Fichiers touchés

| Fichier | Geste |
|---------|--------|
| `finalRendererAgent.js` | `allowRefusal` + filet à l’émission |
| `modeResponseContracts.js` | `isVisionAttachedDescribeContext`, `resolveVisionAttachedComposerDelivery` |
| `mode-response-contracts.test.js` | Suite Vision, cas 1–8 |

### Tests verts

- Vision attachée 8/8 (`mode-response-contracts.test.js`).
- Ancrage Vision (`entity_miss`) : 9/9, pas rouvert.
- 4 rouges préexistants (autres modes / GK `REFUS PROPRE`) : hors lot, non bloquants.

### Verdict

**Lot validé, fermé.** Doctrine stabilisée au canon (invariant 10).  
Phrase réutilisable : *Sur Vision attachée, une description sort ; le refus piste / destination n’atteint plus l’UI.*

---

## Lot fermé — Mandat lecture vs Vision raster (2026-09-01)

Hors P3–P5. Ne rouvre pas l’ancrage `entity_miss`. Précise l’invariant 10 : fallback document interdit aussi sous forme *fichier vide / trop court*.  
Règle durable : [`citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md) **invariant 10** + [`attachment-read-mandate-v1.md`](attachment-read-mandate-v1.md). Cette section est l’historique, pas une seconde source.

### Bug initial

*« analyse le fichier »* + PNG → pipeline `VISION_ATTACHED`, briefing visuel produit, puis le mandat lecture document remplace par *« Fichier vide ou trop court pour une analyse. »*

### Cause racine

Trigger lexical `analyse` + `fichier` + `attachments.length > 0`, **sans** regarder le MIME. Raster sans couche texte → ingest `empty` → file guard document.

### Correctif

`isImageOnlyAttachments` : mandat inactif ; clarify `can_answer_now` ; file guard / repair / filet COMPOSER → incertitude vision, pas *fichier vide*.

### Non-régression — explicite

- Document texte : mandat et *fichier vide* légitimes inchangés.
- `entity_miss` / allowRefusal Vision : lots fermés, pas rouverts.
- FILE_ANALYSIS / SQL / HTML / PDF : hors lot.

### Verdict

**Lot validé, fermé.** Doctrine stabilisée au canon (invariant 10). Preuve : suite raster `image/*` `attachment-read-mandate.test.js` + filet `mode-response-contracts.test.js`.

---

## Lot fermé — Complétude d’input / clause d’existence (2026-08-17)

Hors P3–P5. Ne rouvre pas Vision ni `subject_angle_explore`.  
Règle durable : [`citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md) **invariant 11**. Cette section est l’historique, pas une seconde source.

### Bug initial

Tour MediaRange : *« est-ce que tu connais la marque MediaRange »* puis *« … des dvd de cette marque là donc je voudrais savoir si ça existe toujours »*. La requête web devenait un overview DVD ; sujet et borne d’existence absents.

### Cause racine

Triple perte de sens : extraction tronquée (cible info-seeking coupée à 80 caractères) ; absence de détection de borne côté workload ; absence de reconnaissance existence/fraîcheur. Plus non-portage du sujet conversationnel (*cette marque* ≠ MediaRange).

### Correctif

`existenceScopeGuardPolicy.js` : garde `scope_guard` (pas intent, pas `entities`). Survie dans `effectiveQuery` ; `scope_guards: ["existence_current"]` ; section `existence_current` en tête du plan ; requête web = sujet résolu + borne ; `compression_invalid` si un de ces points lâche.

### Non-régression — explicite

- Vision, `subject_angle_explore`, JUST, ranking, parser multi-unités : intacts.
- Invariants 8–10 : verts.
- Tests dédiés : verts. Rouges restants : préexistants hors lot.

### Replay live

Après *« est-ce que tu connais la marque MediaRange »*, puis la phrase DVD / *si ça existe toujours* : la réponse ouvre sur l’existence actuelle de MediaRange avant tout développement secondaire.

### Fichiers touchés

| Fichier | Geste |
|---------|--------|
| `existenceScopeGuardPolicy.js` | Invariant local + détection + complétude |
| `requestInterpreter.js` / pipeline | Survie `effectiveQuery` |
| `intentCompositionPolicy.js` | `scope_guards` |
| `conversationQueryUnderstanding.js` | Plan + requête retrieval |
| `informationSeekingIntentGuards.js` | Web query sujet + borne |
| `knowledgeFreshnessPolicy.js` / composer | Reconnaissance + ouverture existence |
| `existence-scope-guard.test.js` | Preuve déterministe |

### Tests verts

- Complétude d’input : 5/5 (`existence-scope-guard.test.js`).
- Canon : 2/2 (`citadelle-input-invariants.test.js`).
- Cadrage + Vision (invariants 8–10) : verts, pas rouverts.

### Verdict

**Lot validé, fermé.** Doctrine stabilisée au canon (invariant 11).  
Phrase réutilisable : *Une clause d’existence borne la réponse ; si elle disparaît à la compression, la compression est invalide.*
