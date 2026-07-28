# ADR-20260707 : Simple Factual Directness (P3)

## Statut

**Accepté** (07/07/2026)

## Contexte

Sur le couloir `simple_factual_lookup`, le **routage P2** est sain : `justIntent=general/explain`, `pipelinePath=simple_factual_lookup`, pas de divergence gate.

En revanche, la **surface LLM** peut encore produire un over-refusal :

> « Je n'ai pas pu finaliser une réponse… Réessaie ou précise l'angle qui t'intéresse (géographie, histoire, contexte, etc.). »

Cas canonique terrain : « combien de l dans brocoli ? »

| Couche | État |
|--------|------|
| P2 move / pipeline | ✅ sain |
| P3 contrat surface | ❌ violation |

Cause racine : quand le LLM renvoie vide ou refuse, `resolvePipelineFallback()` basculait sur `buildInformationRecoveryMessage()` — pseudo-clarification générique — au lieu d'une réponse factuelle directe.

Même famille de bug que `how_to_procedural_llm` (P3), pas un faux positif de routage.

## Décision

Verrouiller le couloir `simple_factual_lookup` avec un contrat P3 explicite, sans modifier la gouvernance move (P2).

### 1. Mode `SIMPLE_FACTUAL` (existant, durci)

- Prompt sans `REFUSAL_RULE` globale.
- Interdiction explicite : angle géographie/histoire, « je n'ai pas pu finaliser ».
- `enforceModeContract` : pas de substitution `INSUFFICIENT_SIGNAL_REFUSAL` sur ce mode.

### 2. Verrou directness

- `tryResolveDeterministicSimpleFactual()` — comptages triviaux (lettres dans un mot).
- `enforceSimpleFactualDirectness()` — remplace refus / pseudo-clarify par fallback direct.
- `resolvePipelineFallback()` — branche `isSimpleFactualQuestion` **avant** `buildInformationRecoveryMessage`.

### 3. Shadow P3

- `contract_violation_simple_fact_directness`
- `contract_violation_simple_fact_signals` — `empty_response`, `insufficient_signal_refusal`, `pseudo_clarify_or_recovery`
- `simple_factual_shadow_stats` — agrégation `violation_rate`

Seuil durcissement addon (recommandé) : `violation_rate > 0.3` sur `n ≥ 5`.

## Conséquences

- Questions factuelles bénignes : réponse directe ou résolution déterministe, jamais « précise l'angle ».
- Pas de liste lexicale par mot (brocoli = pattern comptage générique).
- Tests : `simple-factual-composer.test.js` § P3 G12.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `server/src/agent/micro/replies/simpleFactualComposer.js` | Verrou + résolutions déterministes |
| `server/src/agent/utils/genericGreetingGuards.js` | Fallback pipeline |
| `citadelle-vault/.../simple-fast.js` | Enforcement post-LLM |
| `server/src/agent/paths/simpleFastPath.js` | Delivery pipeline |
| `server/src/agent/telemetry/conversationMoveShadowTelemetry.js` | Métrique shadow P3 |

## Références

- [Conversation Move Governance](../../../docs/agents/conversation-move-governance.md) — § P3 simple factual
- [ADR How-To Procedural Directness](./ADR-20260707-How-To-Procedural-Directness-v1.md)
