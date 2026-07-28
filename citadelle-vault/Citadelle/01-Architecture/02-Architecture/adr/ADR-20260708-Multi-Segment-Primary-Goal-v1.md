# ADR-20260708 : Multi-Segment Primary Goal (G18)

## Statut

**Accepté** (08/07/2026)

## Contexte

Requêtes composites : contexte secondaire (date, salut) + but principal (GPU, achat, how-to).

Le P2 impose un hint deux temps (`buildMultiSegmentSystemHint`), mais le P3 ne vérifiait pas que la surface LLM respectait le but principal.

Risque : « Nous sommes le mercredi 8 juillet 2026. » seul — clôture signal-only.

## Décision

### 1. Profil P3 `multi_segment_composite`

- `multiSegmentQualificationPolicy.js`
- Signaux : `primary_goal_miss`, `preamble_without_followup`, `signal_only_closure`
- Entrée : `text` + `segmentPlan` (propagé depuis short-circuit ou `resolveMultiSegmentPlan(query)`)

### 2. Enforcement

- `buildCompositeDeterministicReply()` / `buildResidualFollowUpOpening()` comme fallback structuré
- Préambule date + ouverture sur but principal (ex. carte graphique)

### 3. Shadow P4

- `contract_violation_multi_segment_directness`
- `multi_segment_shadow_stats`

## Conséquences

- Le hint système reste la première ligne de défense ; P3 filette les dérives résiduelles
- `segmentPlan` stocké sur `pipelineTelemetryCtx` pour `_finalizePipelineTurn`

## Fichiers

| Fichier | Rôle |
|---------|------|
| `multiSegmentQualificationPolicy.js` | Détection + enforcement |
| `conversationMoveContractVerification.js` | Profil P3 |
| `agentPipeline.js` | Propagation `segmentPlan` |
| `multiSegmentResponsePlan.js` | Fallback déterministe |

## Références

- [Conversation Move Governance](../../../docs/agents/conversation-move-governance.md) — § G18
