# ADR-20260604 : Suffisance des auto-réponses (règle transversale)

**Date** : 04/06/2026  
**Statut** : ✅ Validé — implémenté  
**Règle** : `auto_reply_total_sufficiency_only`  
**Formule** : *auto-réponse seulement si suffisance totale*

## Contexte

Les court-circuits conversationnels (date/heure, social, méta, familiarité, etc.) pouvaient **clôturer** la requête dès qu'un signal saillant était détecté, alors que la phrase utilisateur comportait un **but principal distinct** (ex. date *afin de* choisir une carte graphique).

Le correctif ponctuel date/heure a révélé une **propriété générale** du système : détection ≠ suffisance.

## Décision

Adopter une **règle transversale** appliquée à tous les short-circuits avant toute réponse terminale :

> **Une réponse automatique ne peut clôturer la requête que si elle la satisfait entièrement.**  
> Sinon, elle devient un **préambule** et laisse place à une **suite structurée**.  
> **Jamais** de court-circuit qui coupe le reste du sens.

### Trois issues

| Branche | Comportement |
| :--- | :--- |
| Suffisance totale | Réponse automatique seule (`INSTANT` ou équivalent) |
| Insuffisance — suivi léger | Préambule signal + ouverture structurée |
| Insuffisance — arbitrage | `multi_segment_composite` → contrat `SIMPLE_FAST` (ou pipeline adapté) |

### Pipeline

```text
requête → buildParseState → candidat short-circuit → evaluateAutoReplySufficiency
  → suffisant ? clôture
  → sinon ? préambule + suite (pas de coupe du sens résiduel)
```

## Implémentation runtime

| Module | Rôle |
| :--- | :--- |
| `autoReplySufficiencyRule.js` | Contrat canon (`AUTO_REPLY_SUFFICIENCY_RULE`) |
| `responseSufficiencyEvaluator.js` | Heuristiques de suffisance |
| `shortCircuitSufficiencyGate.js` | Porte sur tous les chemins `intentShortCircuit` |
| `requestSegmentParser.js` | Segments & marqueurs de but (`afin de`, `pour savoir`, …) |

Tests : `server/tests/response-sufficiency-evaluator.test.js`

## Conséquences

- **Positif** : réponses plus humaines ; fin des correctifs cas par cas ; cohérence avec contrats d'intention.
- **Coût** : quelques requêtes composées passent par `SIMPLE_FAST` au lieu d'`INSTANT` (budget tokens légèrement supérieur).
- **Risque évité** : traiter un indice local comme conclusion globale.

## Liens

- [[02-Architecture/adr/ADR-20260601-Micro-Conversation-Delestage|Micro-délestage conversationnel]]
- [[02-Architecture/adr/ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- [[00-Foundation/VAULT-GOVERNANCE|Gouvernance du Vault]]
