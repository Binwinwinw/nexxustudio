# Testing — Stratégie de validation du dépôt

Ce document définit les principes de test et de validation à appliquer sur le dépôt.

## Objectif

Les tests existent pour éviter les régressions, vérifier les comportements attendus et fournir des preuves avant affirmation.

## Principes

- Chaque correction importante doit être validée.
- Chaque refactor doit préserver le comportement attendu.
- Chaque changement doit être testé au bon niveau.
- Chaque échec doit être analysé avant correction.

## Types de tests

### Tests unitaires

Ils valident les fonctions, classes ou modules isolés.

### Tests d’intégration

Ils valident les interactions entre composants, services ou couches applicatives.

### Tests E2E

Ils valident les parcours complets côté utilisateur.

### Tests manuels

Ils servent aux vérifications ponctuelles, aux scripts d’audit ou aux cas difficiles à automatiser.

## Emplacement des tests

- Backend : `server/tests/`
- E2E : `tests/e2e/`
- Frontend : `src/**/*.test.js` ou `tests/unit/`
- Tests manuels : `server/tests/manual/`

## Règles de validation

- Ne jamais déclarer un correctif validé sans preuve.
- Exécuter les tests pertinents au périmètre modifié.
- Préférer un test ciblé plutôt qu’un lancement massif inutile.
- Ajouter un test quand une régression est plausible.
- Corriger la cause, pas seulement le symptôme.

## Workflow minimal

1. Reproduire le problème.
2. Isoler la zone impactée.
3. Corriger.
4. Vérifier avec le test adapté.
5. Confirmer qu’aucune régression évidente n’a été introduite.

## Cas d’usage agent

Un agent doit toujours préciser :
- ce qui a été testé,
- comment cela a été testé,
- ce qui a été observé,
- ce qui reste non vérifié.

## Principe de sécurité

En cas d’incertitude sur la validité d’un test, considérer le résultat comme non concluant.