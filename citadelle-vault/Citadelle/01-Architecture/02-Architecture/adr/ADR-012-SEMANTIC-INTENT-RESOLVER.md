# ADR-012 — Semantic Intent Resolver

**Date** : 2026-06-25
**Statut** : En déploiement (Assist Mode partiel)
**Auteurs** : Nexxus Engineering

## 1. Contexte et Problème

Historiquement, le routage de première ligne de Nexxus reposait sur des heuristiques déterministes par Regex (ex: `intentShortCircuit`). Bien que très rapides, ces Regex sont fragiles face aux formulations naturelles et requêtes mixtes. 

La frontière entre une requête pure (ex: *"comment tu vas ?"*) et une requête porteuse d'action (ex: *"comment tu vas gérer ça ?"*) provoquait soit des faux positifs bloquant le pipeline de tâche, soit des fuites vers un processus de clarification coûteux (`clarify_then_build`).

## 2. Décision Architecturale

Nous avons inséré un composant de routage sémantique léger : **`semanticIntentResolver`**.

- **Positionnement** : Placé *après* le court-circuit déterministe (qui conserve sa vocation ultra-rapide pour des cas évidents) et *avant* le `clarify_then_build` et les LLM lourds.
- **Mécanisme** : Appel LLM (`zephyr:latest` ou `qwen3.5:9b`) formaté pour renvoyer exclusivement un JSON strict avec un score de confiance et une classification dans une taxonomie restreinte.
- **Responsabilité** : Désambiguïser les signaux (temps, social, identité) pour éviter les clarifications non nécessaires et exécuter les réponses instantanées de manière plus intelligente.

## 3. Stratégie de Déploiement : Shadow vers Assist Mode

Afin de garantir la stabilité de la Citadelle, le resolver suit une politique de promotion gouvernée :

1. **Shadow Mode** : Le routeur analyse, classe, calcule son score de confiance et produit une recommandation qui est uniquement **loggée**. Le flux nominal n'est pas modifié. 
2. **Assist Mode (Actuel)** : Sur la base de l'évaluation du Shadow Mode (100% de JSON valide, bonne isolation des faux positifs), le resolver est autorisé à remplacer le comportement du pipeline **uniquement** pour les intentions jugées peu risquées :
   - `time_lookup`
   - `social_checkin`
3. **Full Routing Mode** : (Cible future) Extension aux autres intentions (ex: `identity_lookup`, `familiarity`) une fois la robustesse des prompts validée sur le terrain.

## 4. Règles de Sécurité (Fail-Closed)

- Le resolver doit toujours retourner un objet JSON valide. En cas de format incorrect ou d'échec de la requête LLM, la décision est ignorée et le système retombe élégamment sur le pipeline classique (`fail-closed`).
- Un seuil de confiance stricte s'applique (`>= 0.85` pour tout usage, `0.60-0.84` accepté uniquement pour la whitelist Assist Mode).
