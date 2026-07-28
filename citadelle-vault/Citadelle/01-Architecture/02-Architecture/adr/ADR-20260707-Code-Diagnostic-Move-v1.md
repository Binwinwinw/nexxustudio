# ADR-20260707 : Code Diagnostic Move + Directness (P2/P3)

## Statut

**Accepté** (07/07/2026)

## Contexte

Le couloir `debug_diagnostic` existait déjà (guards, short-circuit, addon LLM, `CODE_DIAGNOSTIC_V1` pour intents code_*), mais sans gabarit Conversation Move ni verrou P3 homogène aux lots how-to / simple factual.

Cas canonique terrain : « mon nginx renvoie une erreur 502 depuis ce matin ».

| Couche | État avant |
|--------|------------|
| P2 move | ❌ pas d'étape `debug_diagnostic` dans `evaluateConversationMove` |
| P3 surface | ❌ mode `OPEN_PROPOSITION` + `REFUSAL_RULE` ; pas de `enforceDebugDiagnosticDirectness` |
| Shadow | ❌ pas de `contract_violation_debug_directness` |

Risque : pseudo-clarifications (« objectif en une phrase ») ou aperçu conceptuel à la place d'un diagnostic structuré (symptôme → causes → checklist).

## Décision

Appliquer la même discipline **doctrine → code → tests → ADR → spec** que G11/G12.

### 1. P2 — Conversation Move (étape 5c)

- `family=debug_diagnostic`, `domain=technical`
- Symptôme identifiable (composant ou code erreur) → `move=answer_direct`, `pipelinePath=debug_diagnostic`, `contractId=debug_diagnostic_v1`
- Symptôme trop vague → `move=clarify_one`, `pipelinePath=debug_diagnostic_clarify` (une question ciblée incident, pas formulaire objectif/format)

### 2. P3 — Mode `DEBUG_DIAGNOSTIC`

- Prompt sans `REFUSAL_RULE` globale ; `num_predict=480`
- `enforceDebugDiagnosticDirectness()` — remplace refus / pseudo-clarify / aperçu par fallback structuré
- `resolvePipelineFallback()` — branche diagnostic **avant** `buildInformationRecoveryMessage`
- Flag explicite `debugDiagnostic: true` dans `simple-fast.js` (plus d'agrégation dans `pedagogicalOverview`)

### 3. Shadow P3

- `contract_violation_debug_directness`
- `contract_violation_debug_signals` — `empty_response`, `insufficient_signal_refusal`, `pseudo_clarify_or_overview`
- `debug_diagnostic_shadow_stats` — agrégation `violation_rate`

## Conséquences

- Incidents techniques bénins : diagnostic structuré direct, jamais refus générique ni tutoriel install.
- Alignement avec `CODE_DIAGNOSTIC_V1` (evidence before patch) sur la surface conversationnelle.
- Tests : `debug-diagnostic-routing.test.js` § G13 + `conversation-move-governance.test.js` § G13.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `server/src/agent/policies/conversationMovePolicy.js` | Étape 5c + routage |
| `server/src/agent/micro/replies/debugDiagnosticComposer.js` | Move classify + verrou P3 + fallback |
| `server/src/agent/config/modeResponseContracts.js` | Mode `DEBUG_DIAGNOSTIC` |
| `citadelle-vault/.../simple-fast.js` | Enforcement post-LLM |
| `server/src/agent/paths/simpleFastPath.js` | Delivery pipeline |
| `server/src/agent/utils/genericGreetingGuards.js` | Fallback pipeline |
| `server/src/agent/telemetry/conversationMoveShadowTelemetry.js` | Métrique shadow P3 |

## Références

- [Conversation Move Governance](../../../docs/agents/conversation-move-governance.md) — § P3 debug diagnostic (G13)
- [ADR Simple Factual Directness](./ADR-20260707-Simple-Factual-Directness-v1.md)
- [ADR How-To Procedural Directness](./ADR-20260707-How-To-Procedural-Directness-v1.md)
