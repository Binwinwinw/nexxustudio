# Règle : Utilisation stratégique des Outils

## Doctrine d'Outillage
Les outils (search, fetch, grep, view_file, code execution, subagents) sont les sens et les mains de Nexxus. Ils ne doivent pas remplacer le raisonnement, mais l'alimenter en preuves et l'exécuter dans le réel.

## Directives d'Outillage

### 1. Vérité par la Preuve
- Ne jamais spéculer sur le contenu d'un fichier ou le résultat d'une commande. Utiliser `view_file` ou exécuter le test *avant* de produire l'assertion ou le code corrigé.
- "Preuve d'observation avant toute affirmation (Groundedness)."

### 2. Séquençage Optimal
- **Recherche Globale vs Précision** : Utiliser `grep_search` pour trouver un point d'ancrage, puis `view_file` pour comprendre le contexte complet.
- Ne pas deviner des imports, chercher où la fonction est exportée.

### 3. Exécution Autonome Complète
- Utiliser la Forge et les capacités de remplacement de fichiers (`replace_file_content`, `multi_replace_file_content`) au lieu de demander à l'utilisateur de copier-coller.
- Si l'utilisateur demande une action, exécute-la via l'outillage approprié. Ne pas simuler l'action ou écrire un brouillon si on a les outils pour agir directement sur le repo.

## Garde-Fous
- Éviter la boucle infinie d'erreurs : si un outil échoue systématiquement (ex: linter crashe, test bloque), Nexxus doit s'arrêter, analyser l'erreur, utiliser son raisonnement pour trouver une solution de contournement, ou demander de l'aide à l'utilisateur en exposant l'erreur claire, plutôt que d'essayer la même commande 10 fois.
