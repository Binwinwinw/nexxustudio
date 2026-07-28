# ADR-20260527 : Tri d'intention local-first (Intent Triage)

**Date** : 27/05/2026  
**Statut** : ✅ Validé — Phase 1 + Phase 2 implémentées  
**Expert** : Nexxus (Orchestration souveraine)  
**Module** : [[02-Architecture/modules/Intent-Triage-Classifier|Intent-Triage-Classifier]]

## Contexte

Les requêtes ambiguës — notamment *« analyse le code suivant… »* avec snippet exécutable — peuvent fuiter vers **Document Analysis** (résumé « points clés ») au lieu d'une **revue de code** orientée erreurs bloquantes.

La plateforme est **local-first** : le tri d'intention ne doit pas dépendre d'API cloud ni d'un modèle lourd systématique. Les bonnes pratiques agents locaux recommandent : **règles + scores** pour le routage courant, **petit modèle local** uniquement en tie-break sur cas ambigus.

## Décision

Adopter un **cerveau de tri hybride** en tête de `agentPipeline.run()`, avant Document Analysis et l'orchestrateur :

```text
requête → scoreIntentCandidates (règles locales)
       → resolveConfidence (high / medium / low)
       → [si low + opt-in] tie-break Ollama léger
       → routing_action → pipeline cible ou clarification
```

### Principes non négociables

1. **Règles d'abord** — la majorité des cas est tranchée sans LLM.
2. **Zéro cloud** — tie-break via Ollama local uniquement (`INTENT_TRIAGE_OLLAMA=1`).
3. **Fail-closed** — JSON invalide, timeout ou modèle indisponible → retour au tri règles + clarification.
4. **Testabilité CI** — golden set reproductible ; tie-break testé avec mock LLM.
5. **Feedback loop local** — clarifications journalisées en JSONL pour enrichissement incrémental.

## Schéma de sortie (contrat v1)

| Champ | Type | Description |
|-------|------|-------------|
| `top_intent` | `string` | Intention prioritaire |
| `runner_up` | `string \| null` | Intention alternative |
| `confidence` | `"high" \| "medium" \| "low"` | Bande de confiance |
| `confidence_score` | `number` | Score normalisé 0.05–0.99 |
| `needs_clarification` | `boolean` | Clarification requise |
| `routing_action` | `string` | `route_direct` \| `route_labeled` \| `ask_clarification` |
| `score_gap` | `number` | Écart top / runner-up |
| `signals` | `string[]` | Raisons du scoring |
| `scores` | `Record<string, number>` | Scores bruts par intention |

### Taxonomie `top_intent`

| Valeur | Pipeline cible |
|--------|----------------|
| `code_review` | Contrat CODE_INTENT / revue + garde-fou runtime |
| `code_debug` | CODE_INTENT debug |
| `code_explain` | CODE_INTENT explication |
| `code_refactor` | CODE_INTENT refactor |
| `code_correction` | CODE_INTENT correction |
| `code_audit` | CODE_INTENT audit |
| `code_generation` | Livraison code |
| `document_analysis` | Document Analysis |
| `general` | Orchestrateur / conversation |

### Politique de routage

| Confiance | `routing_action` | Comportement |
|-----------|------------------|--------------|
| high | `route_direct` | Routage sans étiquette supplémentaire |
| medium | `route_labeled` | Routage avec intention exposée (SSE) |
| low + ambigu | `ask_clarification` | Message 1/2 utilisateur |

## Phase 2 — Tie-break LLM local (opt-in)

| Variable | Défaut | Rôle |
|----------|--------|------|
| `INTENT_TRIAGE_OLLAMA` | désactivé | `1` pour activer le tie-break |
| `OLLAMA_INTENT_TRIAGE_MODEL` | `zephyr` | Petit modèle Ollama |
| `INTENT_TRIAGE_TIMEOUT_MS` | `3500` | Timeout fail-closed |
| `INTENT_TRIAGE_FEEDBACK` | activé | `0` pour désactiver le JSONL |

Conditions d'activation : `confidence === "low"` uniquement. Un tour, ~120 tokens, JSON strict reprenant les champs du contrat v1.

## Feedback loop → golden set CI

| Artefact | Chemin |
|----------|--------|
| Journal clarifications | `server/data/intent-triage/clarification-feedback.jsonl` |
| Export fixtures | `npm run triage:export-golden` |
| Baseline manuelle | `server/tests/fixtures/intentTriageGoldenQueries.js` |
| Export auto | `server/tests/fixtures/intentTriageGoldenExported.js` |

## Modules runtime

| Fichier | Responsabilité |
|---------|----------------|
| `intentTriageClassifier.js` | Scoring hybride, schéma, clarification |
| `intentTriageLlmTiebreak.js` | Tie-break Ollama optionnel |
| `intentTriageFeedbackRecorder.js` | Append JSONL |
| `intentTriageFeedbackExporter.js` | Export → golden CI |

## Conséquences

### Positives

- Souveraineté et latence maîtrisées (pas de cloud pour le tri).
- Régression calculatrice / document_analysis couverte en CI.
- Évolution incrémentale via feedback terrain local.

### Négatives / limites

- Tie-break désactivé par défaut — ambiguïtés résiduelles sans `INTENT_TRIAGE_OLLAMA=1`.
- Golden exporté requiert clarifications utilisateur (`user_reply`) pour résolution d'intention.
- Pas de buffer streaming UX sur intents `code_*` (hors scope ADR).

## Références

- [[02-Architecture/modules/Intent-Triage-Classifier]]
- `server/tests/intent-triage-classifier.test.js`
- `server/tests/intent-triage-llm-tiebreak.test.js`
- `server/tests/intent-triage-golden.test.js`
