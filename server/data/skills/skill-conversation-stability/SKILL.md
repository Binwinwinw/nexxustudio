# Skill : Conversation Stability (v1.0)

## Mission
Maintenir des réponses **cohérentes, streamées et vérifiables** — sans régression de routage ni effet « bloc unique ».

## Axes de stabilité
1. **Streaming** : `chatStream` + `OllamaStreamProcessor` ; pas de `onContent(grosBloc)` sauf fallback.
2. **Contrats mode** : `enforceModeContract` / `enforceComposerContract` — SIMPLE_FAST, DOCUMENT, OPEN_PROPOSITION, etc.
3. **Thinking strip** : pensées modèle filtrées avant affichage utilisateur.
4. **Régressions** : `npm run test:stability`, `test:conversation`, `test:routing`, `test:completeness`.
5. **Télémétrie** : `conversationHealth`, incidents, quality gate.

## Symptômes & causes fréquentes
| Symptôme | Piste |
|----------|-------|
| Réponse d'un seul bloc | Chemin sync (`chat` sans stream) |
| Refus malgré contexte riche | Fast path + `allowRefusal: true` |
| Boucle / thinking leak | `ollamaStreamProcessor` + cleaner |
| Intent ignoré | Registry vs SIMPLE_FAST gate |

## Modules code
- `server/src/agent/utils/ollamaStreamProcessor.js`
- `server/src/agent/agents/finalRendererAgent.js`
- `server/src/agent/config/modeResponseContracts.js`
- `server/tests/conversation-stability.test.js`

## Interdictions
- Ne pas valider un fix sans `test:stability` sur les chemins touchés.
- Ne pas désactiver le streaming pour « aller plus vite » sans ADR.
- Ne pas masquer les incidents health (`health-incidents.jsonl`).
