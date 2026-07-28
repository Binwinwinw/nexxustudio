# ADR-20260707 : How-to Procedural Directness (P3)

## Statut

**Accepté** (07/07/2026)

## Contexte

La gouvernance Conversation Move (ADR-20260707) a stabilisé le **routage** sur `how_to_procedural_llm` : `move=answer_direct`, gate inactive, short-circuit correct.

En shadow terrain (juillet 2026), un défaut **structurel de surface** est apparu sur ce path uniquement :

| Signal | Observation |
|--------|-------------|
| `contract_violation_how_to_directness` | 4/4 sur corpus procedural initial |
| Texte surface | `INSUFFICIENT_SIGNAL_REFUSAL` (« Je vois la piste… ») |
| Cause | Couple `SIMPLE_FAST` + `REFUSAL_RULE` globale écrase l'addon procédural |
| P2 | **Non en cause** — `diverged=false`, `clarify_gate_mismatch=false` |

Le contrat addon (`buildHowToProceduralLlmSystemAddon`) interdisait déjà la clarification, mais le mode LLM général autorisait encore le refus par signal insuffisant.

## Décision

Introduire un **couloir de sortie dédié** pour `how_to_procedural_llm`, sans modifier la gouvernance move/gate (P2).

### 1. Mode `HOW_TO_PROCEDURAL`

- Prompt système **sans** `REFUSAL_RULE` globale.
- Interdiction explicite de `INSUFFICIENT_SIGNAL_REFUSAL`.
- `num_predict=480` — volume suffisant pour étapes numérotées.
- `enforceModeContract` : pas de troncature à 2 phrases ; purge du refus canonique.

### 2. Addon et filet P3

- `buildHowToProceduralLlmSystemAddon` — ban explicite du pattern de refus.
- `enforceHowToProceduralDirectness()` — remplace pseudo-clarification par canevas procédural.
- `buildHowToProceduralDirectFallback()` — étapes numérotées culinaire/craft si le modèle dévie encore.

### 3. Propagation runtime

- Flag `howToProcedural: true` depuis `resolveHowToShortCircuit()`.
- `simple-fast.js` / `simpleFastPath.js` : `allowRefusal=false` sur tout le couloir.

### Doctrine

> **P2 fixe le mouvement. P3 fixe la surface sur le path promis.**

Ne pas remonter la correction à `clarification_gate`, `evaluateConversationMove`, ni à la qualification `ambiguous` / `complex` (Arduino, app mobile continuent à clarifier légitimement).

## Validation terrain (post-verrou)

| Requête | `contract_violation` | Surface |
|---------|----------------------|---------|
| PC bureautique | false | Procédure LLM (composants, étapes) |
| Tarte aux pommes | false | Canevas fallback (étapes numérotées) |

Session shadow : `total=2`, `violations=0`, `violation_rate=0.0`.

Corpus pré-verrou (4/4 violations) : ordinateur vague, PC bureautique, tarte, kayak — tous `how_to_procedural_llm`.

## Télémétrie shadow (observation)

Événement `[CONVERSATION_MOVE_SHADOW]` phase `served` :

- `contract_violation_how_to_directness`
- `contract_violation_signals`
- `how_to_procedural_shadow_stats` (agrégat session)

Seuil historique de décision : `violation_rate > 0.3` sur `n ≥ 5` tours `how_to_procedural_llm`. Le verrou a été activé à 4/4 violations structurelles avant le 5ᵉ replay formel.

## Fichiers

| Module | Rôle |
|--------|------|
| `server/src/agent/config/modeResponseContracts.js` | `RESPONSE_MODES.HOW_TO_PROCEDURAL`, `getHowToProceduralSystemPrompt` |
| `server/src/agent/policies/howToQualificationPolicy.js` | Addon, fallback, `enforceHowToProceduralDirectness` |
| `citadelle-vault/.../simple-fast.js` | Mode dédié, `num_predict`, double garde |
| `server/src/agent/paths/simpleFastPath.js` | Propagation `howToProcedural` |
| `server/src/agent/telemetry/conversationMoveShadowTelemetry.js` | Métrique P3 shadow |

## Tests

```bash
cd server && node --test tests/how-to-qualification-policy.test.js
cd server && node --test tests/conversation-move-governance.test.js
```

## Conséquences

### Positives

- Fin des pseudo-clarifications sur `how_to_procedural_llm` quand `move=answer_direct`.
- Séparation nette diagnostic P2 (gouvernance) vs P3 (contrat surface).
- Modèle réutilisable pour d'autres paths à risque d'over-refusal.

### Limites connues

- Fallback culinaire encore **générique** (canevas craft réutilisé) — raffinement optionnel ultérieur.
- Requêtes sans shell `comment (faire|on fait)` restent hors short-circuit how-to (gap shell distinct).

## Références

- [[ADR-20260707-Conversation-Move-Governance-v1]]
- `docs/agents/conversation-move-governance.md` — § P2 shadow, § P3 directness
- Cas canonique : `HOW_TO_PC_DESKTOP_BUREAUTIQUE_REFUSAL` (pré-verrou)
