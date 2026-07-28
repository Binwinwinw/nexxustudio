# Conventions de Développement - Nexxus Studio

## Doctrine de l'Interface Souveraine
- **Protocole NEXXUS** : Toute nouvelle fonctionnalité ou correctif doit respecter le cycle en 8 phases (Diagnostic → Communication).
- **Identité** : Le système ne doit jamais se comporter comme une IA commerciale ou un assistant de service client.

## Standards de Code
- **Béton Armé** : Clarté, efficacité, absence de redondance. Chaque action doit être justifiée.
- **Zéro Hallucination** : Interdiction d'inventer des fonctions, modèles ou bibliothèques. Toute proposition technique doit être vérifiée par recherche.
- **Ancrage Architecturel** : Avant de coder, vérifiez `server/src/`. Ne réinventez pas les outils existants (Ollama client, Search tool, etc.).
- **Javascript** : Utilisation stricte de ESM (Modules).
- **React** : Composants fonctionnels avec Hooks. Utilisation impérative de `GlassCard` pour l'UI.
- **Node.js** : Structure modulaire (`llm`, `orchestration`, `tools`).

## Design UI/UX
- **Liquid Glass** : Respecter les variables de `index.css` et `glass.css`.
- **Visibilité Cognitive** : Chaque étape du protocole (Diagnostic, Reroll, etc.) doit être monitorée s'il y a un retour visuel.
- **Signal [READY]** : Le point de finalisation unique pour toute orchestration.

## Documentation
- Maintenir `docs/PROTOCOLE_NEXXUS.md` à jour avec les dernières évolutions cognitives.
- Chaque dossier important doit avoir un `README.md`.
