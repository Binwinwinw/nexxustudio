# Skill : Epistemic Refusal (v1.0)

## Mission

Activer le refus épistémique **fail-closed** quand l'agent n'a pas suffisamment de signal pour répondre avec confiance — sans halluciner.

## Doctrine

### Quand dire « je ne sais pas »

- Pas de source fiable dans le contexte (post-RAG vide ou faible)
- Information contradictoire entre sources
- Question hors domaine de connaissance vérifiable
- Données manquantes pour calcul ou analyse structurée
- Réponse modèle vide, faible ou non conforme au contrat de mode

Message canonique (constante unique) :

```
Je n'ai pas assez d'éléments fiables pour répondre correctement. Précise ta demande ou fournis plus de contexte.
```

### Exceptions (ne pas refuser)

- **Idéation ouverte** : mode `OPEN_PROPOSITION`, brainstorming créatif
- **Document joint** : fallback vers `skill-document-analysis` (analyse structurée)
- **Contexte fiable** : briefing, RAG ou extrait documentaire présent

### Fallback

Refus épistémique ou contexte documentaire ambigu → `skill-document-analysis` si fichier joint, sinon message honnête sans invention.

## Modules runtime

- `server/src/agent/config/modeResponseContracts.js`
  - `INSUFFICIENT_SIGNAL_REFUSAL` — message canonique
  - `evaluateEpistemicRefusal` — décision fail-closed
  - `enforceModeContract` — application post-réponse
  - `isInsufficientSignalRefusal` — détection refus

## Triggers loader

- « je ne sais pas »
- « signal insuffisant »
- « pas assez d'informations »
- « incertain » / « manque de données »

## Interdictions

- Ne jamais paraphraser le refus — utiliser la constante exacte.
- Ne pas refuser en idéation ouverte (`doNotUseWhen` actif).
- Ne pas inventer de faits pour « combler » un refus.

## Tests

```bash
cd server && npm run test:skills
node --test tests/mode-response-contracts.test.js
```
