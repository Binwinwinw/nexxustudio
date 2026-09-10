# Cartographie — Intent guards (lot 3)

| Champ | Valeur |
|-------|--------|
| **Périmètre** | `utils/intent-guards/*`, satellite `utils/conversation/genericGreetingGuards.js` |
| **Chemin racine** | `server/src/agent/` |
| **Date de mise à jour** | 2026-08-17 |
| **Statut** | **Lot fermé** (cartographie) |
| **Mode** | Lecture seule — carte structurelle (pas de refactor) |
| **Lecture** | Inventaire, pas cible — [`METHODE.md`](./METHODE.md) |
| **Fermés, non rouverts** | Lots 0, 1, 2, 4 |
| **Hors périmètre** | Policies domaine / registre G38+ ; canon input ; Vision / JUST / `subject_angle_explore` ; 3e doc amont ; nouveau parser |

Objectif : ce que les guards **bloquent**, ce qu’ils **laissent passer**, **blast radius**, dépendances amont / aval.  
Ce ne sont **pas** des décideurs de path. Ce sont des **prédicats** (souvent booléens / slots) que lots 1–2 et le fast path consomment.

---

## 1. Articulation

```
requête
  │
  ├─ [lot 2] understandQuery / turnComprehension     ← guards comme signaux
  ├─ [lot 1] clarify / SC / just-intent              ← guards comme conditions de rail
  ├─ [lot 0] simpleFastPath flags                    ← guards comme modes
  └─ [lot 4] Sovereign web query / skip              ← quelques derive*WebQuery
```

| Nature | Module type | Sortie |
|--------|-------------|--------|
| Guard | `isXRequest(query)` | bool |
| Extracteur léger | `extractXTarget` / `parseFamiliarityQuery` | slots |
| Hub sentinelle | `intentGuards.js` | capability / permission / self-mod |
| Classif legacy | `intentClassifier.js` | taxonomie Sovereign (lot 4) |

**Règle :** un guard **signale**. Le SC / gate / social **décide**. Recopier un guard dans une policy métier = hors cette vue (registre).

Satellite inclus : `genericGreetingGuards` — le lot 1 le rangeait avec les guards. Pas un `*IntentGuards.js`, même rôle (bloquer un accueil sur du travail).

---

## 2. Ce qu’ils bloquent / laissent passer

Pattern commun : **shell + exclusions**.

| Effet | Exemple | Bloque | Laisse passer |
|-------|---------|--------|---------------|
| Priorité factuelle vs social | `isInformationSeekingWithTarget` | Accueil / G35 si « je cherche des infos sur X » | Social pur, apprentissage (`LEARNING_PREEMPT`) |
| Anti-FAQ | `intentGuards.js` capability/permission | Doc statique / identité trop large | Vraie demande de capacité système |
| Anti-accueil | `isSubstantiveWorkRequest` / greeting | « Prêt à t’aider » sur une tâche | Check-in phatique |
| Anti-datetime local | `shouldBypassLocalDatetimeShortCircuit` | Rail calendrier local si web explicite | Datetime local sinon |
| Anti-how-to trop large | `isHowToRequestShell` | How-to générique sans scope | Procédure bornée |
| Compare vs explain | `isCompareChooseRequest` | Rail explain si arbitrage | Explication simple |
| Translation ready | `isTranslationPipelineReady` | Clarify si cible absente | Pipeline si prêt |
| Repo / debug | `isRepoAnalysisRequest`, `isDebugDiagnosticRequest` | SIL / social | Full / rail dédié |

Ils **ne bloquent pas** : compose, web, canon input.  
Ils **ne livrent pas** (sauf helpers `get*DeterministicReply` / `build*WebQuery` collés à côté — bord policy, pas topologie).

---

## 3. Familles (inventaire, pas registre)

Dossier `utils/intent-guards/` : ~35 modules. Groupés pour le debug, pas pour lister les regex.

| Famille | Modules (ex.) | Rôle |
|---------|---------------|------|
| **Sentinelle / identité** | `intentGuards.js`, `identityIntentGuards.js`, `acknowledgmentIntentGuards.js` | Capacité, permission, « qui es-tu », ack |
| **Info / familiarité** | `informationSeekingIntentGuards.js`, `familiarityIntentGuards.js`, `generalKnowledgeIntentGuards.js`, `learningRequestIntentGuards.js` | Infos sur X vs apprendre vs fiche. `isConceptLookupRequest` = famille définition (shells sanitisés, sans lexique sujet). Concepts publics → GK open-world ; concepts produit Citadelle → Vague 2. |
| **Pédagogie** | `pedagogicalOverview*`, `beginnerTopicOverview*`, `technicalOverview*`, `technicalLearningPath*`, `careerLearningPath*`, `programmingPedagogyLight*` | Overview / parcours |
| **Procédure / how-to** | `howToRequestIntentGuards.js`, `procedureIntentGuards.js`, `adminProcedureIntentGuards.js` | Marche à suivre |
| **Décision / compare** | `compareChooseIntentGuards.js`, `selectiveDecisionIntentGuards.js` | Arbitrage |
| **Code / audit / repo** | `repoAnalysisIntentGuards.js`, `debugDiagnosticIntentGuards.js`, `reactAuditIntentGuards.js`, `analyticalCritiqueIntentGuards.js` | Travail code |
| **Idéation / archi** | `ideationIntentGuards.js`, `architectureDesignIntentGuards.js`, `webProjectScopingGuards.js` | Projet / scope |
| **Web / calendrier** | `currentWebFactIntentGuards.js`, `externalCalendarLookupIntentGuards.js` | Fait actuel / agenda |
| **Méta / traduction** | `metaConversationIntentGuards.js`, `translationIntentGuards.js`, `contextReferenceIntentGuards.js` | Méta-fil, langues, « ça » |
| **Livrable** | `promptForArtifactIntentGuards.js`, `presentationOutlineIntentGuards.js`, `localFileUriIntentGuards.js` | Artefact / URI |
| **Cuisine** | `recipeKnowledgeIntentGuards.js`, `culinaryPracticalIntentGuards.js` | Recette vs pratique |
| **Legacy classif** | `intentClassifier.js` | Taxonomie Sovereign (`social_chit_chat` … `safety`) |

`normalizeFamiliarityQuery` (`familiarityIntentGuards`) = **hub de normalisation** partagé. Pas un 2e NLU. Pas à étendre ici.

---

## 4. Blast radius

| Consommateur | Usage | Gravité si le guard ment |
|--------------|-------|--------------------------|
| `intentShortCircuit` (lot 1) | Conditions de rails, early exits | Path faux (Zorin-class : mauvais rail) |
| `clarificationDecisionPolicy` (lot 1) | Suppress clarify si guard « answerable » | Clarify inutile ou absent |
| `conversationQueryUnderstanding` / domain registry (lot 2) | Signaux de domaine | Workup faux |
| `conversationMovePolicy` (lot 2) | How-to / info-seeking / compare | Move faux |
| `socialPatternPolicy` / greeting (lot 2 / satellite) | `suppressesSocialForInformationSeeking` | Social sur une demande d’infos |
| `simpleFastPath` (lot 0) | Flags overview / debug / career | Mauvais mode SIMPLE_FAST |
| `SovereignOrchestrator` (lot 4) | `intentClassifier` + `derive*WebQuery` | Mauvais expert / query web |
| `practicalAdviceRoutingGuard` | Full pipeline si décision sélective | Escalade injustifiée |

**Rayon :** presque tout le tour. **Autorité :** aucune — un `true` n’est pas un `pipelinePath`.

Changer un regex de guard = collision potentielle SC + social + clarify. C’est pourquoi le lot 1 interdisait de « simplifier le SC » sans carte des guards.

---

## 5. Dépendances

### Amont (ce dont les guards se servent)

- Query brute + parfois `history` (peu).
- `normalizeFamiliarityQuery` / `normalizeForParse`.
- **Fuite vers policies :** plusieurs guards importent déjà `policies/web`, `policies/routing`, `policies/delivery` (éviter le cycle — miroirs regex dupliqués, ex. learning vs info-seeking).

### Aval (qui les appelle)

- Lots 1–2 surtout.
- Lot 0 flags.
- Lot 4 classif + web query.
- Micro replies / continuity (hors carte fine).

**Interdit lot 3 :** inverser la flèche (policy qui devient le seul parseur). Canon : pas de 2e NLU.

---

## 6. `genericGreetingGuards` (satellite)

Bloque une réponse d’accueil si la query est du **travail substantiel**.  
Consomme beaucoup de guards + policies (math, document, web, social).  
Blast : recovery / fallback « prêt à t’aider » (agent.js / pipeline).  
Même couche que les IntentGuards pour le debug : *« pourquoi un greeting a « ou n’a pas » sorti »*.

---

## 7. Debug live

| Symptôme | Guard à regarder |
|----------|------------------|
| Social sur « je cherche des infos sur X » | `isInformationSeekingWithTarget` / `suppressesSocialForInformationSeeking` |
| Clarify alors que le sujet est nommé | Guards « answerable » dans le gate (how-to, compare, info-seeking, translation ready) |
| Accueil sur une vraie tâche | `genericGreetingGuards` / `isSubstantiveWorkRequest` |
| Datetime local alors que « cherche sur internet » | `shouldBypassLocalDatetimeShortCircuit` |
| Sovereign `NORMAL_CONVERSATION` vs `EXPERT_TASK` | `intentClassifier.js` (re-lecture lot 4, pas lot 1) |
| Path how-to / debug / repo | Guard homonyme + rail SC |

Les regex restent dans le fichier. Cette vue dit **qui écoute**, pas comment matcher.

---

## 8. Vérifs

| Vérif | Attendu |
|-------|---------|
| Grep `utils/intent-guards` dans `intentShortCircuit` | Nombreux `is*` — hub |
| Grep `isInformationSeekingWithTarget` | SC + social + understand + gate |
| Grep `normalizeFamiliarityQuery` | Hub partagé, pas un parseur parallèle |
| Ne pas dupliquer le registre G38+ ici | OK |

---

## 9. Fermeture

Lot 3 **fermé** : couche guards = prédicats ; bloquent / laissent passer ; blast radius ; deps.

**Reste plateforme :** policies domaine écrite — [`agent-domain-policies.md`](./agent-domain-policies.md) (registre G38+, vue séparée, sans fusion).

Lots fermés non retravaillés. Pas de parser. Pas de 3e doc amont.

---

## 10. Journal

| Date | Changement |
|------|------------|
| 2026-08-17 | Création lot 3 — `utils/*IntentGuards` + greeting satellite |
| 2026-08-17 | État validé : 5 couches écrites ; reste policies domaine hors topologie |
| 2026-08-17 | Pointeur : policies domaine écrite — [`agent-domain-policies.md`](./agent-domain-policies.md) |
| 2026-08-18 | Lecture : inventaire pour décider — [`METHODE.md`](./METHODE.md) |
