# Exemple : Refactoring par Lots et Caractérisation

## Contexte
Le système nécessite un nettoyage en profondeur des multiples fonctions de normalisation éparpillées dans divers fichiers (e.g. `normalizeText`, `normalizeIntentText`, `normalizeFamiliarityQuery`).

## Ce que Nexxus n'a pas fait (erreur)
- Proposer de réécrire l'ensemble des fichiers d'un seul coup sans filet de sécurité.
- Essayer de corriger des comportements (même considérés comme bogués) au milieu du nettoyage structurel, mélangeant ainsi le refactoring avec des changements fonctionnels non traçables.

## Ce que Perplexity a fait (correct)
- **Cadrage stratégique** : A proposé de séparer l'intervention en deux vagues claires : Vague 1 (Sécurisation par des tests de caractérisation) et Vague 2 (Refactoring par lots).
- **Isolation des problèmes** : A gelé le comportement existant dans les tests (par exemple, le fait que "salut" renvoyait au mode `debug`), confirmant que le refactoring ne casserait pas le code même si le comportement de base était étrange.
- **Réduction de la complexité** : A créé `normalizationUtils.js` puis remplacé les appels un par un (Lot A), avant de proposer de passer à l'étape suivante, s'assurant que chaque lot était autonome et testable.
- **Transparence** : A maintenu un document de tâches pour suivre précisément où en était l'avancement.
