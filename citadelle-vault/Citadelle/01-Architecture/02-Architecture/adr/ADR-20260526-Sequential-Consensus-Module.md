# ADR 20260526 : Intégration du Sequential Consensus Module

**Date :** 26/05/2026
**Statut :** Proposé / Expérimental
**Auteurs :** NEXXUS

## Contexte
Le projet open-source `llm-council` (par A. Karpathy) démontre que la fiabilité des réponses LLM augmente significativement lorsqu'un "conseil" de modèles génère, critique et synthétise des solutions. 
Cependant, l'implémentation originale (massif parallélisme + API externes) contrevient directement à la doctrine de **La Citadelle**, qui impose :
1. **Souveraineté (Local-First) :** Pas de dépendance à OpenRouter.
2. **Parcimonie (Lazy-Loading) :** 1 à 2 experts actifs maximum simultanément pour éviter la dérive sémantique et la surcharge mémoire locale.
3. **Orchestration Silencieuse :** Le débat interne ne doit pas polluer le contexte utilisateur.

## Décision
Nous décidons d'implémenter un **Sequential Consensus Module**. Ce module reprendra les bénéfices épistémiques de `llm-council` mais adaptera son architecture pour être "Citadelle-compliant".

### Architecture du Pipeline
Le processus s'exécutera strictement en séquence (jamais plus de 2 agents instanciés) :
1. **`expert_generator`** : Invoqué séquentiellement (ex: 2 fois) pour produire 2 solutions distinctes via Ollama (ou en utilisant 2 modèles locaux différents l'un après l'autre).
2. **`expert_critic`** : Reçoit les 2 solutions anonymisées. Évalue, note, et justifie quelle est la meilleure selon les critères du *Pipeline Épistémique v4.6* (Proof-before-Assertion).
3. **`expert_chairman`** : Lit les solutions et l'audit du critique, puis rédige la synthèse finale qui sera la seule voix exposée à l'utilisateur.

### Conditions d'Usage (Fail-Closed / Haute Fidélité)
Cette approche multiplie par 3 ou 4 la consommation de compute local (tokens générés). Elle ne sera **pas** utilisée par défaut.
Elle sera réservée aux :
- Décisions d'architecture (ADRs).
- Conflits persistants ou désaccords entre agents/modules.
- Tâches classifiées comme "Haute Fidélité" par le routeur sémantique.

## Conséquences
**Positives :**
- Augmentation drastique de la fiabilité pour les tâches complexes.
- Respect absolu de la doctrine de La Citadelle (Souveraineté, Parcimonie).
- Traçabilité des décisions grâce à l'audit généré par l'`expert_critic`.

**Négatives :**
- Latence perçue par l'utilisateur augmentée (3 passes consécutives).
- Complexité accrue du gestionnaire de flux (nécessite un buffer de contexte interne qui n'est pas envoyé au front-end).

## Plan d'Implémentation
1. **Sandbox (`06-Experiments/`) :** Développement de `sequential-consensus-test.js` avec mock d'Ollama.
2. **Intégration (`03-Forge/`) :** Câblage avec le `ollamaStreamProcessor.js` existant.
3. **Production :** Ajout au routeur de tâches pour déclenchement sur les intentions "Haute Fidélité".
