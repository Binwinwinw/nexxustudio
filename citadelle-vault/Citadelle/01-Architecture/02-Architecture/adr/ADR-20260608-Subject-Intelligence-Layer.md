# ADR-20260608 : Subject Intelligence Layer

**Date** : 27/05/2026  
**Statut** : ✅ Validé — implémenté  
**Formule** : *comprendre d'abord de quoi on parle, puis router l'action*

## Contexte

Les court-circuits procéduraux et de familiarité traitaient forme d'intention et sujet dans le même module. Les cas comme « lancer Need for Speed » généraient des procédures Forge hors sujet. Une couche transverse était nécessaire, réutilisable hors procédure.

## Décision

Pipeline en trois temps :

```text
Subject Intelligence → Intent Router → Response Builder
```

| Couche | Rôle | Modules |
| :--- | :--- | :--- |
| Intelligence | État du monde pur (nature, confidence, usage, resolvedEntityId, relations, candidates) | `subjectGraph`, `subjectIntelligenceLayer`, `knownEntityQuickLookup`, `internalEntityRegistry`, `subjectNormalizer`, `subjectSessionMemory` |
| Router | Décision d'action (`skip`, `clarify`, `disambiguate`, `allow_procedure`, `route_deterministic`) | `subjectIntentRouter`, `subjectRoutingHints` |
| Response | Texte utilisateur uniquement | `subjectResponseBuilder` |

### Contrat d'ambiguïté global

Règle `subject_ambiguity_contract` :

```text
confidence === low  OR  candidates.length > 1  OR  ambiguous === true
→ allowDirectAnswer = false → clarify | disambiguate
```

Aucun module ne doit émettre une réponse directe en violation (`assertDirectAnswerAllowed`).

### Identité vs canonical

- `canonical` : forme normalisée (`nfs` → `need for speed`)
- `resolvedEntityId` : identité stable (`public:game:need-for-speed`, `session:project:atlas`)

### Mémoire session faible

`session.memory.lastResolvedSubjects` (Map par `sessionId`) :

- mémorisation après résolution `high` ou ancre « le projet X »
- rappel sur tour suivant (« lance Atlas » après « le projet Atlas »)

### miniResearchGate

`resolveMiniResearch()` retourne `{ candidates, confidence, sources: [{ type, confidence }], needsAsyncWebLookup }` — **sans** texte ni appel web bloquant en v1. Extension web : sources séparées `local | web`, pas de fusion opaque.

### Usage (routage déterministe futur)

`execute_launch`, `install`, `internal_handoff`, `learn_about`, `compare`, `troubleshoot`, `configure` → `resolveDeterministicRouteHint()` (ex. `launcher_guide_builder`).

## Mini-délibération (fast / slow path léger)

| Champ | Valeurs |
| :--- | :--- |
| `deliberationMode` | `none` \| `mini` \| `clarify` |
| `replyPolicy` | `fast_direct` \| `fast_reasoned` \| `clarify_first` |

Déclenchement `mini` : domaine composite (`projet` + entité publique ex. NFS), `confidence !== high`, ou contrat d'ambiguïté.

Pipeline : `buildSubjectInterpretedState` → `resolveDeliberationPolicy` → `planProcedureIntent` → `runMiniDeliberation` (heuristique sync, Zephyr optionnel via `OLLAMA_MINI_DELIBERATION_MODEL`, timeout `MINI_DELIBERATION_TIMEOUT_MS`).

Chemins : `procedure_subject_nature_gate`, `procedure_subject_mini_deliberation`, `procedure_subject_reasoned_gate`.

Variables : `MINI_DELIBERATION_OLLAMA=1` pour activer Zephyr/Ollama ; défaut **heuristique seule** (latence minimale). Modèle : `OLLAMA_MINI_DELIBERATION_MODEL` (défaut `zephyr`).

## Familiarité (branchée)

`familiarityReplyBuilder.js` consomme `buildSubjectInterpretedState` + `planFamiliaritySubjectIntent` + `buildFamiliaritySurfaceReply` (même contrat d'ambiguïté, continuité `session.memory`).

Tests : `server/tests/familiarity-subject-intelligence.test.js`

## Subject Graph (v1 locale)

`subjectGraph.js` — source de vérité déterministe :

- `SUBJECT_GRAPH_ENTITIES` : entités publiques + internes + alias + `relations[]` + `platforms[]`
- `resolveSubject(raw, { sessionContext, domain })` → `entityId`, `confidence`, `candidates`
- Consommé par `knownEntityQuickLookup`, `internalEntityRegistry`, `subjectDomainSignals`, `subjectRoutingHints`, `launcherGuideBuilder`

Tests : `server/tests/subject-graph.test.js`

## Tours méta (feedback assistant)

`conversationTurnType.js` — avant résolution métier :

| Type | Carry-over session | Launcher / install |
| :--- | :--- | :--- |
| `task_request` | oui | oui |
| `elliptic_followup` | oui | oui |
| `meta_feedback` | **non** | **non** |

Mentions référentielles (« revoir le fichier nfs ») ≠ lancement jeu. Chemin `meta_feedback_deterministic`.

Tests : `server/tests/subject-meta-turn.test.js`

## Taxonomie install (`subjectInstallUsage.js`)

| Kind | Exemple | Usage mappé |
| :--- | :--- | :--- |
| `install_app_user` | Steam, jeu, logiciel | `INSTALL` |
| `install_project_dependency` | npm install, dépendances MVP | `INTERNAL_HANDOFF` |
| `bootstrap_project` | npm create vite, créer le projet | `INTERNAL_HANDOFF` |
| `install_runtime_env` | brew install node | `CONFIGURE` |

État SIL : champ `installKind` + `usageGuidanceLine(usage, { installKind })`.

Tests : `server/tests/subject-install-usage.test.js`

## Hors scope

- Subject Graph persistant / retrieval web
- Enrichissement automatique des entités hors registre local
- Web async dans `miniResearchGate`

## Tests

`server/tests/subject-nature-before-procedure.test.js`

## Liens

- [[02-Architecture/adr/ADR-20260607-Refusal-Sufficiency|Refusal sufficiency]]
- [[02-Architecture/adr/ADR-20260603-Web-Candidate-Memory|Mémoire candidats web]]
