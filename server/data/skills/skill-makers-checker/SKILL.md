# Skill : Makers Checker (v1.0)

## Mission

Appliquer le pattern **makers-checker** : un agent primary propose, un agent checker vérifie, consensus avant livraison.

## Doctrine fail-closed

| Outcome | Condition |
|---------|-----------|
| `confirmed` | consensus ≥ seuil (défaut 0.85) |
| `fallback-primary` | consensus bas ou sécurité warning — primary conservé avec avertissement |
| `blocked` | consensus bas + `fallbackToPrimary: false`, ou sécurité `blocked` |
| `error` | exception runtime |

## Checks checker

1. **Hallucination** — affirmations sans sources, citations non vérifiables
2. **Cohérence** — alignement avec contexte / mémoire (placeholder 0.85)
3. **Sécurité** — URLs externes, exécution code, patterns injection prompt
4. **Précision** — `skillAccuracy` + `sourceReliability` du contexte

## Module runtime

- `server/src/verification/makersChecker.js` — `MakersChecker`, `validateDecision`, `generateReport`

## Usage

```javascript
import MakersChecker from '../../src/verification/makersChecker.js';

const checker = new MakersChecker({ consensusThreshold: 0.85 });
const result = await checker.validateDecision(
  { score: 0.9, containsFactualClaims: false, sources: [{ id: '1' }] },
  { skillAccuracy: 0.92, sourceReliability: 0.95 },
);
console.log(checker.generateReport(result));
```

## Interdictions

- Ne pas bypasser le checker en mode CRITICAL sans ADR.
- Ne pas désactiver fail-closed sécurité en production.
- Désactivation temporaire : `MAKERS_CHECKER_DISABLED=true`.

## Tests

```bash
cd server && node --test tests/makers-checker.test.js
npm run test:skills
```
