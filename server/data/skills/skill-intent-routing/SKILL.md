# Skill : Intent Routing (v1.0)

## Mission
Appliquer le **Intent Contract Registry v1.2** : une intention → un mode de réponse → un chemin pipeline cohérent.

## Contrats clés
| ID | Effet |
|----|-------|
| `IDEATION_OPEN` | Bypass SIMPLE_FAST, mode OPEN_PROPOSITION, pas de refus signal insuffisant |
| `DOCUMENT_ATTACHED` | Pipeline documentaire complet, pas de salutation générique |
| `DOCUMENT_ANALYSIS` | Mode DOCUMENT, analyse structurée |
| `VISION_ATTACHED` | Pipeline vision multimodal |
| `DIAGNOSTIC` | Analyse technique, preuve avant assertion |
| `SOCIAL` / `INSTANT` | Réponses courtes, pas d'orchestration lourde |

## Guards centralisés
- `shouldBypassSimpleFast()` — PJ, URL, `forcedExpertKey`, idéation, document, vision.
- `conversationGuards.js` — détection document / vision / idéation.
- `resolveIntentContract(query, packet)` — source unique de vérité.

## Règles de routage
1. **Pièce jointe texte + analyse** → jamais SIMPLE_FAST seul.
2. **Idéation ouverte** → propositions numérotées, pas compilation web par défaut.
3. **Ambiguïté** → clarifier l'intention avant exécution lourde (fail-closed).
4. **1–2 experts max** — doctrine lazy-loading (AGENTS.md §1).

## Modules code
- `server/src/agent/config/intentContractRegistry.js`
- `server/src/agent/utils/conversationGuards.js`
- `server/src/agent/agentPipeline.js`
- `server/src/agent/micro/` — exécution déterministe ([[skill-micro-delestage]])

## Complément micro-délestage (P1)

Le registry définit le **contrat** ; la couche `micro/` exécute le **short-circuit** sans LLM pour identité, idéation et familiarité. Voir ADR `ADR-20260601-Micro-Conversation-Delestage` dans le Vault.

## Interdictions
- Ne pas court-circuiter un contrat documentaire par une réponse sociale.
- Ne pas activer l'orchestrateur complet pour une salutation de 3 mots.
