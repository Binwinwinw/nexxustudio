# 🛠️ Standards de Codage de La Citadelle

Ces standards garantissent que chaque ligne de code produite dans la Forge est maintenable, sécurisée et conforme à l'architecture souveraine.

## 1. Architecture & Structure
- **Modularité** : Chaque fonctionnalité doit être isolée dans un module ou un service.
- **Droit à l'Oubli** : Les données temporaires doivent être nettoyées après exécution.
- **Chemins Absolus** : Toujours utiliser des résolutions de chemins robustes (`path.join`, `__dirname`).

## 2. Qualité du Code (JS/Node)
- **Asynchronisme** : Privilégier `async/await` sur les callbacks.
- **Typage** : Utiliser JSDoc pour documenter les types et les retours de fonctions.
- **Erreurs** : Toujours wrapper les opérations critiques dans des blocs `try/catch` avec des logs explicites.

## 3. Documentation
- Chaque fichier doit comporter un header expliquant son rôle.
- Les fonctions complexes doivent avoir une explication de leur algorithme.

## 4. Sécurité (Sentinel)
- Pas de secrets en clair dans le code.
- Validation systématique des entrées utilisateur.
- Utilisation de `requireAuth` ou `requireLocalOperator` sur tous les endpoints sensibles.

---
#standards #qualité #code #gouvernance
