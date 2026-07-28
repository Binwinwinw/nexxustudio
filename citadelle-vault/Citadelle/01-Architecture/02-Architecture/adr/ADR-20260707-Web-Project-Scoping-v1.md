# ADR-20260707 : Web Project Scoping v1

## Statut

**Accepté** (07/07/2026)

## Contexte

Les requêtes de **création de site web** (SharePoint, HTML, WordPress, intranet…) étaient capturées à tort par `architecture_design_deterministic` — couloir conçu pour « comment créer un agent / pipeline / outil », pas pour un livrable web utilisateur.

Symptôme observé : « je voudrais créer un site avec sharepoint » → réponse RAG / 3 approches techniques, hors-sujet.

Correctif partiel P2 : exclusion dans `architectureDesignIntentGuards.js`. Insuffisant seul : après exclusion, le tour tombait sur `request_interpreter_clarify` (« Tu parles de quel sujet exactement ? ») — clarification générique, pas cadrage SharePoint.

## Décision

Introduire la famille **`web_project_scoping`** dans `CONVERSATION_MOVE_V1` (étape 5b), avec deux couloirs :

| Path | Move | Quand |
|------|------|-------|
| `web_project_scoping_clarify` | `clarify_one` | Plateforme ou type de site encore trop large |
| `web_project_scoping_direct` | `answer_direct` | Type de site explicite (ex. site de communication SharePoint) |

### Doctrine

> Le LLM ne choisit pas si la demande est « architecture d'agent » ou « construction de site ». `ConversationMove` fixe la famille **avant** short-circuit et génération.

### Détection

Réutilise la garde d'exclusion architecture (`isWebArtifactBuildExclusionForArchitectureDesign`) comme critère positif `isWebProjectScopingRequest` — une seule source de vérité sémantique.

### Clarification ciblée (SharePoint)

Question unique : **site d'équipe** · **site de communication** · **espace documentaire**.

## Conséquences

- `architecture_design_deterministic` interdit sur artefacts web sans sujet système explicite (RAG, pipeline, agent).
- Short-circuit `intentShortCircuit.js` sert `web_project_scoping_*` avant `request_interpreter_clarify`.
- `agentPipeline.js` : autorité move sur `clarifyQuestion` via `conversationMoveAuthority.js`.
- Tests G11 dans `conversation-move-governance.test.js`.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `server/src/agent/utils/webProjectScopingGuards.js` | Détection, clarify, cadrage direct |
| `server/src/agent/policies/conversationMovePolicy.js` | Étape 5b + routage |
| `server/src/agent/micro/classifiers/intentShortCircuit.js` | Exécution déterministe |
| `server/src/agent/utils/architectureDesignIntentGuards.js` | Exclusion architecture (P2) |

## Références

- [Conversation Move Governance](../../../docs/agents/conversation-move-governance.md) — § G11
- [ADR Conversation Move Governance v1](./ADR-20260707-Conversation-Move-Governance-v1.md)
