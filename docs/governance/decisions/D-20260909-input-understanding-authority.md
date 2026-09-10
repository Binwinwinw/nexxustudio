# ADR — Input understanding as the authority for routing

**ID** : `D-20260909-input-understanding-authority`  
**Date** : 2026-09-09  
**Statut** : `proposed`  
**Supersède** : —  
**Remplacée par** : —

Append-only. Si la norme change : nouvelle fiche + cette ligne `Statut: superseded`. Le corps ci-dessous **ne se réécrit pas**.

**Index** : [`../decision-trace.md`](../decision-trace.md)  
**Diagnostic** : [`../from-input-understanding-to-authoritative-routing.md`](../from-input-understanding-to-authoritative-routing.md)  
**Plan** : [`../plan-authoritative-input-understanding.md`](../plan-authoritative-input-understanding.md)  
**Canon** : [`../citadelle-input-invariants.md`](../citadelle-input-invariants.md)

---

## Contexte

La Citadelle a un cycle de compréhension (`runAgentUnderstandingPhase` → `understandQuery` + `buildRequestWorkup`) et un `response_commitment` (dont `responseType` C4.1). Le routage réel reste souvent **pattern → rail → contrat**, avec des classificateurs aval qui écrivent encore.

Lots 1–5, C4.1–C4.2, how-to named tool, gate langue : **clos**. Ne pas les rouvrir. Ils ont réparé des **familles déjà câblées** ou le job de reply. Ils n’ont pas rendu le cycle autoritaire sur l’acte.

Working tree local plus avancé que HEAD et que `dev/PLAN.md`. Cette fiche photographie cet état.

---

## Problème observé

Une intention humaine n’est structurée en amont **que** si elle ressemble à une famille déjà détectée. Sinon :

1. le cycle pose `unknown` / `task.kind = null` ;
2. JUST étiquette `general/explain` (shadow, défaut de domaine) ;
3. IntentStage pose `expert_task` (longueur, `?`) ;
4. `resolveIntentContract` écrit un contrat de classe — souvent `CODE_INTENT`, web coupée ;
5. le rendu est hors sujet ou un filet d’ancrage **détruit** la reply.

Le problème n’est pas un mot-clé manquant, un modèle trop petit, ou JUST. C’est un **vide d’acte** comblé par des auteurs aval.

**Fait vérifié (probe 2026-09-09)** : `isCodeIntentRequest === false` et `matchedBy = orchestrator:expert_task` → `CODE_INTENT`.  
**Hypothèse** : ce chemin est fréquent dès que G29 se tait, pas un cas isolé.

---

## Décision d’architecture visée

Le cycle existant est la **seule autorité de compréhension**. Ordre non négociable :

```
frame d’intention (acte, sujet, contexte fourni, trous)
  → response_commitment (job de reply, canal, livrable, contrat licencié)
  → rail / contrat (forme compatible seulement)
  → rendu (bouche, pas requalification)
```

- `requestFrame.task.kind` porte l’acte. Un silence de **domaine** ne doit plus effacer l’acte.
- `response_commitment` se **dérive** du frame par tables déterministes (pas un 2e NLU).
- IntentStage, JUST, fallback `orchestrator:*`, SC emit, COMPOSER **consomment**. Ils n’écrivent pas l’acte ni un contrat métier sans guard.
- Slot **requis** manquant → `clarify` (même job). Slot **utile** manquant → `direct` + trou listé, pas `unknown`.
- `unknown` réel (bruit, pas d’acte) → `CONVERSATION_STANDARD` seulement.

C4 `responseType` reste le job de **reply**. Il ne fusionne pas avec l’acte.

---

## Options envisagées

| ID | Option | Verdict |
|----|--------|---------|
| A | Patch lexical / rail / contrat par incident | **Refusée** — répète le trou |
| B | 2e NLU / packet JSON métier (domaine produit, scores par champ) | **Refusée** — 2e NLU, invariant 1 et 4 |
| C | Consume JUST comme vérité de routage | **Refusée** — invariant 6 |
| D | Élargir `entities` (currentItem, NER) | **Refusée** — invariant 5 |
| E | Blocklist `CODE_INTENT` seul, sans acte dans le frame | **Insuffisante** — DIAGNOSTIC / DOCUMENT_ANALYSIS prendraient le relais |
| F | Remplir `task.kind` depuis les guards **existants** ; dériver commitment ; aval consommateur | **Retenue** |
| G | Frame JSON parallèle consommateur électronique | **Rejected** (même famille que B) — ne pas ressortir |

---

## Option retenue

**F.** Enrichir le frame **déjà** produit par `analyzeRequestIntentFrame` / `understandQuery` :

1. Tenir le typedef `task.kind` (`debug`, `compare`, `procedure`, `build`, plus `advise` / `plan` / `social` si besoin) via guards déjà là — pas un parser neuf.
2. Dériver `responseType` / `kind` / `intentContractId` depuis ce frame dans `buildRequestWorkup`.
3. Interdire l’écriture de contrat métier par classe orchestrateur. Guard only.
4. Étendre la cohérence C4.2 aux rails aujourd’hui non typés, **après** 1–3.
5. Tester par **familles d’actes et paraphrases**, pas par path canonique unique.

Spécialisations (`INTENT_FAMILIES_V1`, `GUIDED_PRODUCT_RECOMMENDATION`, translation frame) restent des **raffinements** une fois l’acte posé.

---

## Ce qu’on refuse explicitement

Voir aussi [Interdits](../decision-trace.md#interdits-actifs).

### Ce qu’il ne faut plus refaire

- **Patch par produit** — téléphone, GPU, n8n, phpMyAdmin comme cible. Un révélateur n’est pas un lot.
- **Nouvelle NLU parallèle** — IntentStage consommateur, NER, 5e packet, JSON « userAct + domain métier + confidence 0.92 ».
- **Contrat écrit par une classe aval** — `matchedBy: orchestrator:expert_task` n’est pas un routage.
- **`unknown` fourre-tout neutre** — c’est un aspirateur vers le mauvais contrat, pas un fallback inoffensif.
- **Regex locale par formulation** — une paraphrase hors `mustInclude` doit passer le **même** assert de frame.
- **JUST comme autorité** — shadow. `general/explain` nomme le vide ; ça ne licence pas un rail.
- **Clarifier l’absence de budget / critère** comme si l’acte n’existait pas.
- **Rouvrir lots clos** (1–5, C4.1–C4.2, how-to named tool, langue COMPOSER) « pour réparer la compréhension ».
- **Champ `entities` nouveau** ou extracteur branché vers SC / JUST.
- **Filet d’ancrage comme unique mémoire du sujet** — le frame copie le sujet ; l’ancrage ne le reconstruit pas.

---

## Conséquences attendues

- Un acte d’orientation / procédure / création / diagnostic est **nommé** avant tout path.
- Un contrat code exige un guard code, pas une classe `expert_task`.
- Le web demandé par le workup n’est plus coupé par un contrat inventé.
- Les tests de famille cassent si une paraphrase retombe en `unknown` + contrat interdit.
- Les cartes C4 / PRE_EMIT restent des photos ; cette ADR est la **norme visée**. Runtime = seulement après validations du [plan](../plan-authoritative-input-understanding.md) + GO de lot.

Statut `proposed` : on peut s’en servir pour **ne pas** coder le contraire. On ne change pas le runtime.

---

## Risques

| Risque | Gravité | Mitigation |
|--------|---------|------------|
| Élargir `task.kind` par une nouvelle couche de regex | Haute | Guards existants seulement ; paraphrases hors lexicon |
| F2 (contrats) avant F1 (acte) | Haute | Ordre du plan : F2 sans acte laisse `unknown` factuel générique |
| G31 clarify-first vs answer-then-ask | Moyenne | Trancher **dans** une fiche / lot F4, pas en silence |
| Typer tout le SC d’un coup | Haute | Un rail témoin après F1–F2, pas le hub entier |
| Traiter cette ADR comme du runtime | Haute | Statut `proposed` jusqu’à `accepted` **et** lot nommé |
| Recopier cette page dans le canon | Moyenne | Pointer. Le canon ne change qu’avec comportement + tests |

---

## Invariants à préserver

Canon [`citadelle-input-invariants.md`](../citadelle-input-invariants.md) :

1. Une chaîne amont. Pas de 2e NLU.
2. `understandQuery` + `buildRequestWorkup` = vérité structurelle.
3. `runAgentUnderstandingPhase` = seul orchestrateur de compréhension.
4. Packet → copie → arrêt.
5. `entities` : liste fermée.
6. JUST shadow.
7. Tests = preuve.
8. Cadrage sujet / exemple / correction.
9–11. Vision / existence : hors cette ADR, intacts.

Lots 1–5 et C4.1–C4.2 : ne pas rouvrir. `responseType` enum : ne pas l’élargir pour y coller l’acte.

---

## Preuves / documents liés

| Type | Lien |
|------|------|
| Diagnostic | [`from-input-understanding-to-authoritative-routing.md`](../from-input-understanding-to-authoritative-routing.md) |
| Plan | [`plan-authoritative-input-understanding.md`](../plan-authoritative-input-understanding.md) |
| Cartes | [`agent-upstream-decision.md`](../../cartographie/agent-upstream-decision.md) §6.5 U7 · [`c4-response-type-decision.md`](../../cartographie/c4-response-type-decision.md) · [`pre-emit-coherence.md`](../../cartographie/pre-emit-coherence.md) · [`agent-comprehension-conversation.md`](../../cartographie/agent-comprehension-conversation.md) |
| Audit local | [`ARCHITECTURE_08092026.md`](../../ARCHITECTURE_08092026.md) |
| Familles | `server/src/agent/policies/intent/intentFamilyRegistry.js` |
| Frame | `server/src/agent/policies/intent/requestIntentFrame.js` |
| Tests existants (preuve partielle, pas couverture de famille) | coverage G31, C4, current-turn-anchoring, intent-contract-registry |

Pas de nouveau test runtime dans cette fiche. Les prérequis de test sont dans le plan.

---

## Fichiers et zones potentiellement concernés

Leviers (futurs lots, **pas** un périmètre ouvert) :

- `server/src/agent/policies/intent/requestIntentFrame.js` — `detectTaskKind`
- `server/src/agent/policies/conversation/conversationQueryUnderstanding.js` — assessment, commitment
- `server/src/agent/nexxusAgentCycle.js` — porte (ne pas doubler)
- `server/src/agent/config/intentContractRegistry.js` — fallback `orchestrator:`
- `server/src/agent/stages/IntentStage.js` — reclassification
- `server/src/agent/micro/classifiers/intentShortCircuit.js` — emit C4.2
- `server/src/agent/utils/intent-guards/selectiveDecisionIntentGuards.js` — forme d’acte advise/compare
- Hors périmètre par défaut : `entities`, JUST consume, vault ADR historiques, `.memory/`

---

## Conditions de validation future

Cette ADR passe `accepted` seulement si :

1. GO explicite sur **le texte** (pas un lot code).
2. Les validations préalables du plan (dumps frame, télémétrie `matchedBy`, politique d’incomplétude) sont faites **ou** explicitement reportées dans une nouvelle fiche.

Le runtime ne change que si, **en plus** : fiche lot 5 champs + GO de lot nommé + preuves tests de **famille**.

---

## Conditions de supersession

Nouvelle fiche `D-…` avec `Supersède: D-20260909-input-understanding-authority`.  
Cette fiche : `Statut: superseded` + `Remplacée par: D-…`. Corps inchangé.

Interdit : deux `accepted` contradictoires sur le même mécanisme sans `Supersède`.  
Interdit : éditer ce document pour le faire dire la norme suivante.
