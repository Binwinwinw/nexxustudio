# Cartographie — Compréhension / conversation (lot 2)

| Champ | Valeur |
|-------|--------|
| **Périmètre** | `nexxusAgentCycle.js`, `policies/conversation/*`, `policies/social/*`, `policies/epistemic/*`, gate clarify **en tant que consommateur** (détail lot 1) |
| **Chemin racine** | `server/src/agent/` |
| **Date de mise à jour** | 2026-08-17 |
| **Statut** | **Lot fermé** (cartographie) |
| **Mode** | Lecture seule — carte structurelle (pas de refactor) |
| **Lecture** | Inventaire, pas cible — [`METHODE.md`](./METHODE.md) |
| **Amont / aval** | Lots 0–1–4 **fermés, non rouverts** |
| **Hors périmètre** | Lot 3 (`utils/*IntentGuards`) ; policies domaine / registre G38+ ; canon input ; Vision / JUST / `subject_angle_explore` ; 3e doc amont ; nouveau parser |

Objectif : voir où se fait la transition **comprendre → décider**.  
Ce lot ne décide pas le path. Il produit des **artefacts** que le lot 1 consomme.

---

## 1. Articulation

```
[lot 0] agentPipeline.run
        │
        ▼
[lot 2] ★ comprendre ★
        runAgentUnderstandingPhase
          understandQuery
          buildRequestWorkup          (cycle cognitif)
          buildTurnComprehension
        │
        ▼
[lot 2→1] ★ bascule ★
        evaluateConversationMove
        resolveClarificationGate      [impl. lot 1]
        applyConversationMoveAuthority
        social bypass (si clarify)
        │
        ▼
[lot 1] décider
        runConversationShortCircuit
        (épistémique = policy lot 2, déclenchée dans le SC)
        │
        ▼
[lot 0 / 4] exécuter / livrer
```

| Question | Lot |
|----------|-----|
| Qui orchestre le tour ? | 0 |
| Qui **comprend** (structure, move, phatique, incertitude) ? | **2 (ce doc)** |
| Qui **tranche** path / rail / contrat ? | 1 |
| Qui livre le texte ? | 4 (plein) / 0 (SIMPLE_FAST) |

**Frontière :** comprendre = artefacts (`understanding`, `workup`, `turnComprehension`, `conversationMove`).  
Décider = `path` + `reply` ou `shouldClarify`.  
Exception sociale : reply déterministe **avant** le SC si le gate clarify allait partir — c’est encore de la compréhension sociale qui **court-circuite** la décision, pas un 3e amont.

---

## 2. Cycle « comprendre »

Porte unique déclarée : `runAgentUnderstandingPhase` (`nexxusAgentCycle.js`).

```
intent_assessment → evidence_requirement → retrieval_decision → response_commitment
```

Règle : `COGNITIVE_CYCLE_RULE` (`cognitive_cycle_factorized_v2`).

| Étape | Fonction | Sortie |
|-------|----------|--------|
| 1. Structure | `understandQuery` | domaines, `intentMode`, `responseStrategy`, sous-buts |
| 2. Workup | `buildRequestWorkup` | 4 blocs cognitifs + `action_decision` (hints retrieval / capacités) |
| 3. Tour | `buildTurnComprehension` | but primaire, dominance work/social, attentes de réponse |
| 4. Boucle | `createTurnLoopState` | état court Parse→Decide→Act→Verify→Repair≤2 |

**Ne produit pas** de `pipelinePath`.  
**Peut** poser `retrieval_decision` (web ou skip) — hint pour Sovereign (lot 4), pas une reply.

Le pipeline importe aussi `understandQuery` / plans **en parallèle** de la façade (déjà noté lot 0). Ici : la vérité du cycle reste `conversationQueryUnderstanding.js`.

Canon input (invariants 1–11) : une seule chaîne amont. Ce lot **décrit** cette chaîne. Il ne la redéfinit pas.

---

## 3. Quatre sous-vues

### 3.1 Compréhension conversationnelle

| Module | Rôle |
|--------|------|
| `conversationQueryUnderstanding.js` | Trois questions : domaine / sous-buts / stratégie |
| `turnComprehension.js` | Hypothèse d’énoncé + `turn_loop` — projection, **pas** 2e parse métier |
| `conversationSubjectExtraction.js` | Sujet du tour |
| `conversationFramingPolicy.js` | Sujet / exemple / correction (invariant 8 — pointer, ne pas recopier) |
| `currentTurnAnchoringPolicy.js` | Ancrage tour courant |
| `activeGoalPolicy.js` | But actif / « qui pilote » |
| `openExplorationFramePolicy.js` | Cadre exploration / relance loisir |
| `existenceScopeGuardPolicy.js` | Clause existence / fraîcheur (invariant 11) |
| `conversationTurnRoutingPolicy.js` | Famille de tour → rails autorisés (G46 — **consommé** par lot 1) |

Sortie typique : `primaryDomain`, `workIntentCount`, `responseStrategy`, `primaryGoal.kind`, `mayFinalizeSocial`.

### 3.2 Social / phatic

| Module | Rôle |
|--------|------|
| `socialPatternPolicy.js` | G35 / G43 — patterns > clarify / factuel / web |
| `socialAcceptanceOfOfferPolicy.js` | Acceptation d’offre (G46.1) |
| `socialChatContinuityPolicy.js` | Continuité chat |
| `socialCompositeReplyPolicy.js` | Composite identité + capacités |
| `casualExplanationLightPolicy.js` | Relance légère ancrée fil |
| `postRepairSocialClosePolicy.js` | Fermeture après repair |

`SOCIAL_PATTERN_BLOCKED_PATHS` : `clarification_gate`, `simple_factual_lookup`, `COMPOSER`, info-seeking, etc.

**Où ça parle :**

1. **Avant SC** — si `shouldClarify` : `resolveSocialPatternShortCircuit` peut livrer (`social_deterministic`) et **annuler** le clarify.  
2. **Dans le SC** (lot 1) — même policy, autre moment.

Check-in *« coucou quoi de neuf »* : compréhension sociale → reply. Pas Sovereign.

### 3.3 Clarification

| Module | Rôle lot 2 |
|--------|------------|
| `evaluateConversationMove` | Move unique : `answer_direct` / `clarify_one` / `tool` / `refuse` |
| `applyConversationMoveAuthority` | Le move **prime** sur le gate legacy |
| `resolveClarificationGate` | Implémentation **lot 1** (`clarificationDecisionPolicy`) — consomme `justIntent`, triage, `turnComprehension` |

Matrice gate (lot 1, rappel) : `can_answer_now` / `can_answer_with_assumptions` / `needs_clarification` (ambiguïté **bloquante** seulement).

Autorité P2 :

- Gate dit clarify + move dit answer → **supprime** le clarify.
- Move `clarify_one` + question → **early turn** (texte) sans SC.
- Flag `CONVERSATION_MOVE_AUTHORITY=0` : autorité off.

C’est **la** bascule comprendre → décider sur l’ambiguïté.

### 3.4 Épistémique

| Module | Rôle |
|--------|------|
| `epistemicUncertaintyResolutionPolicy.js` | Inférer → clarifier → vérifier → **ensuite** répondre |
| `uncertaintyPolicy.js` | Addon prompt |
| `aiVerificationPolicy.js` | Vérif assertions IA |

États : `known_contextualizable` / `ambiguous_probable` / `unknown_real` / `potentially_stale`.

**Déclenchement :** `resolveEpistemicUncertaintyShortCircuit` **dans** `intentShortCircuit` (tôt + tard).  
Policy = lot 2. Ordre des rails = lot 1. Ne pas recopier la table SC ici.

Mode orchestrateur `EPISTEMIC` (lot 4) = budget / forme de compose. Autre chose que cette policy.

---

## 4. Transition comprendre → décider

Ordre **observé** dans `agentPipeline.run` (après attachments / décomposition) :

```
1. runAgentUnderstandingPhase          [lot 2 — artefacts]
2. classifySummaryContract             [domaine summary — hors ce lot]
3. evaluateJustIntent                  [lot 1 — JUST shadow]
4. evaluateConversationMove            [lot 2]
5. resolveClarificationGate            [lot 1, input lot 2]
6. applyConversationMoveAuthority      [lot 2 — BASCULE]
7. social pattern si clarify           [lot 2 — peut livrer]
8. runConversationShortCircuit         [lot 1 — décide path]
```

| Signal | Comprendre (lot 2) | Décider (lot 1) |
|--------|--------------------|-----------------|
| Domaines / stratégie | `understandQuery` | SC + contrats |
| Besoin de preuve | `retrieval_decision` | `forcedExpertKey` / web (lot 4) |
| Ambiguïté | move + turnComprehension | gate + SC |
| Phatique | patterns G35 | path `social_deterministic` ou bypass |
| Incertitude | états épistémiques | hit SC epistemic |

**Décide trop tôt (lot 2) :** social reply avant SC — voulu (anti-clarify bureaucratique).  
**Décide trop tard :** épistémique seulement dans le SC — une incertitude déjà « comprise » au workup peut encore être ignorée si le rail SC ne match pas.  
**Double lecture :** famille G46 dans `turnComprehension` / classifier **et** dans le SC (déjà U4 lot 1).

---

## 5. Inventaire (périmètre lot 2)

| Zone | Fichiers clés |
|------|----------------|
| Façade | `nexxusAgentCycle.js` |
| Conversation | `conversationQueryUnderstanding.js`, `turnComprehension.js`, `conversationMovePolicy.js`, `conversationMoveAuthority.js`, framing / subject / existence / activeGoal / openExploration |
| Social | `policies/social/*` |
| Épistémique | `policies/epistemic/*` |
| Clarify (conso) | `clarificationDecisionPolicy.js` — carte fine = lot 1 |

Guards (`isHowTo…`, `isInformationSeeking…`) : **lot 3**. Cités ici comme dépendances, pas cartographiés.

---

## 6. Debug live

| Console | Sens lot 2 |
|---------|------------|
| `queryUnderstanding` / `requestWorkup` (télémétrie) | Comprendre OK |
| `📋 Intention : Social / …` | JUST (lot 1) a **lu** le tour ; pas encore le path |
| `Composition : primary=social_checkin` | Artefact composition |
| `⚡ Pattern social G35` | Social a **livré** — transition courte |
| `clarification_gate` | Bascule clarify (sauf autorité / social bypass) |
| Puis `pipelinePath=social_deterministic` ou SC | Lot 1 a décidé |

Si le path est faux : d’abord *qu’est-ce qui a été compris* (domaines, move, phatique), ensuite *qui a tranché* (lot 1).

Si le path est un **rail spécialisé** (ex. `web_project_scoping_*`) alors que la demande n’est pas ce livrable : trou **METHODE C4** — pattern détecté appliqué sans décision de correspondance. Pas le même diagnostic que cycle vs SC. Cadrage : [`c4-response-type-decision.md`](./c4-response-type-decision.md). **Pas de runtime.**

---

## 7. Risques

| ID | Risque | Gravité |
|----|--------|---------|
| C1 | Workup pose retrieval, Sovereign / SC ignore ou double | Moyenne |
| C2 | Social avant SC vs social dans SC — deux portes | Moyenne |
| C3 | Move authority vs gate — deux décideurs ambiguïté | Haute (doc P2) |
| C4 | Épistémique seulement dans SC | Moyenne |
| C5 | `turnComprehension` vs G46 SC — double famille | Moyenne (U4) |

---

## 8. Vérifs

| Vérif | Attendu |
|-------|---------|
| Grep `runAgentUnderstandingPhase` | Surtout `agentPipeline` |
| Grep `applyConversationMoveAuthority` | Après gate, avant SC |
| Grep `resolveSocialPatternShortCircuit` | Bypass clarify + SC |
| Grep `resolveEpistemicUncertaintyShortCircuit` | `intentShortCircuit` seulement |
| Smoke « coucou quoi de neuf » | Comprendre social → `social_deterministic`, pas COMPOSER |

---

## 9. Fermeture

Lot 2 **fermé** : cycle comprendre décrit ; bascule vers décider nommée ; social / clarify / epistemic situés.

**Cadrage validé :** bascule comprendre → décider (artefacts → autorité move → social avant SC si clarify → lot 1 path ; épistémique = policy dans le SC).

**Pas fait ici :** policies domaine (registre, pas cette vue) — écrite à part : [`agent-domain-policies.md`](./agent-domain-policies.md). Lot 3 **écrit** : [`agent-intent-guards.md`](./agent-intent-guards.md).

Lots 0–1–4 non retravaillés. Pas de 3e doc amont. Pas de parser. Pas de mélange registre.

---

## 10. Journal

| Date | Changement |
|------|------------|
| 2026-08-17 | Création lot 2 — compréhension / conversation / social / epistemic |
| 2026-08-17 | Cadrage validé : 4 couches écrites ; lot 3 = prochain candidat gardes |
| 2026-08-17 | Pointeur : policies domaine écrite — [`agent-domain-policies.md`](./agent-domain-policies.md) |
| 2026-08-18 | Lecture : inventaire pour décider — [`METHODE.md`](./METHODE.md) |
| 2026-09-06 | Debug live : pointeur C4 (pattern sans correspondance), pas de lot |
| 2026-09-06 | METHODE C4 cadrage — [`c4-response-type-decision.md`](./c4-response-type-decision.md), pas de runtime |
