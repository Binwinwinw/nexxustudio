# ADR-20260606 : Persistance session du document_briefing (proposé)

**Date** : 05/06/2026  
**Statut** : 📋 Proposé — **non implémenté** (activation conditionnée au terrain)  
**Prérequis** : [[02-Architecture/adr/ADR-20260605-Document-Continuity|ADR-20260605 — Continuité documentaire]] (implémenté, store process)  
**Règle** : `session_document_briefing_persistence`  
**Formule** : *mémoire de process suffisante aujourd’hui → DB session seulement si le terrain prouve le besoin de survie au redémarrage Node*

## Contexte

La continuité documentaire v1 persiste `document_briefing` en **mémoire process** (`documentTurnState.js`). Après redémarrage du process Node, le store est vide : le pipeline retombe sur `analysis_only` via `inferDocumentStateFromHistory` — **moins riche** (pas de `keyBlocks` issus du source, pas de hash stable).

Cette perte est **assumée** tant que le scénario terrain (`mon_css.css` → suivi) tient sans redémarrage. Si le terrain exige la **même richesse** (`analysisRichness: full`) après restart, une persistance **fil session** devient pertinente — **sans** fusion avec le patrimoine curé (ChromaDB, M4).

Distinction non négociable (cf. [[02-Architecture/adr/ADR-20260601-Memoire-Fil|Mémoire de fil]]) :

| Couche | Périmètre | Contenu |
| :--- | :--- | :--- |
| **Fil session** | Conversation courante | Transcript + `document_briefing` JSON versionné |
| **Patrimoine curé** | Multi-session, validé | Faits RAG — **hors scope** |

## Décision (quand activée)

Persister l’artefact `document_briefing` (schéma `schemaVersion: 1`) lié à `sessionId`, chargé **avant** `resolveDocumentContinuity` au début de `agent.run`, invalidé si une nouvelle pièce jointe produit un `documentId` différent.

### Contrats conservés à l’identique

- `analysisRichness` : `full` | `analysis_only`
- `needsRawDocumentReingest` — pas de contournement par la DB
- Pas de stockage du **blob brut** en base — uniquement l’artefact encodé
- Même ordre pipeline : follow-up avant short-circuit / SIMPLE_FAST

### Flux cible

```text
agent.run(sessionId)
  → loadDocumentBriefingFromSession(sessionId)  // hydrate documentTurnState
  → resolveDocumentContinuity(...)
  → … pipeline …
  → recordActiveDocumentAnalysis(...)
  → saveDocumentBriefingToSession(sessionId, briefing)  // post-analyse / post-follow-up
```

### Stockage (option retenue par défaut)

**Événement JSON versionné** dans le fil session existant (`session_events` ou équivalent), plutôt qu’une colonne dédiée ad hoc :

| Champ événement | Valeur |
| :--- | :--- |
| `family` | `DOCUMENT_BRIEFING` |
| `payload` | `document_briefing` (JSON, ≤ taille gouvernée ex. 32 Ko) |
| `sessionId` | clé de partition |

Alternative acceptable : table `session_document_state` (`session_id`, `document_id`, `briefing_json`, `updated_at`) si le volume d’événements devient bruyant.

### Invalidation

| Signal | Action |
| :--- | :--- |
| Nouvelle PJ texte, hash ≠ `documentId` actif | `clear` + ré-encode tour 1 |
| `isExplicitClearDocumentRequest` | purge session |
| Session expirée / archivée | pas de rechargement |

## Critères d’activation (terrain)

Implémenter **seulement si** au moins un critère est observé en production ou recette :

1. Redémarrage nodemon / déploiement pendant un fil document actif → suivi dégradé inacceptable (`analysis_only` insuffisant).
2. Besoin de `keyBlocks` + hash après restart sans re-PJ.
3. Document Analysis View ou jobs async réutilisant le même `sessionId` après reload worker.

**Recette minimale avant code DB** :

```text
mon_css.css → analyse (full) → redémarrage process Node → « proposer des améliorations »
  → sans DB : analysis_only ou repli historique
  → avec DB (cible) : document_analysis_followup + richness full
```

## Implémentation prévue (esquisse)

| Module | Rôle |
| :--- | :--- |
| `sessionDocumentBriefingStore.js` | `load` / `save` / `clear` par `sessionId` |
| `documentTurnState.js` | hydrate au load ; delegate save au store si flag `SESSION_DOCUMENT_BRIEFING=1` |
| `agentPipeline.js` | hook load en tête de `run` ; save après `recordActiveDocumentAnalysis` |
| Tests | mock store ; pas de MySQL live obligatoire en CI |

**Feature flag** : `SESSION_DOCUMENT_BRIEFING=1` (fail-closed : désactivé par défaut).

## Conséquences

- **Positif** : continuité `full` survivant au restart ; audit trail session.
- **Coût** : écriture DB par analyse documentaire ; gouvernance taille JSON.
- **Risque évité** : mélange fil / patrimoine curé ; double source de vérité non versionnée.

## Liens

- [[02-Architecture/adr/ADR-20260605-Document-Continuity|Continuité documentaire v1 (implémenté)]]
- [[02-Architecture/adr/ADR-20260601-Memoire-Fil|Mémoire de fil]]
- [[02-Architecture/adr/ADR-20260603-Web-Candidate-Memory|Mémoire candidate Web]] (autre couche, ne pas fusionner)
- `server/src/agent/micro/continuity/documentBriefingEncoder.js`
- `server/src/agent/micro/continuity/documentTurnState.js`
